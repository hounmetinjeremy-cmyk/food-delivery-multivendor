'use client';

// Core imports
import {
  ApolloCache,
  ApolloError,
  useMutation,
  useQuery,
} from '@apollo/client';
import React, {
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { throttle } from '@/lib/utils/methods';

// API and GraphQL
import {
  GET_RESTAURANT_DELIVERY_ZONE_INFO,
  GET_RESTAURANT_PROFILE,
  GET_ZONES,
  UPDATE_DELIVERY_BOUNDS_AND_LOCATION,
} from '@/lib/api/graphql';

// Context
import { ToastContext } from '@/lib/context/global/toast.context';
import { RestaurantLayoutContext } from '@/lib/context/restaurant/layout-restaurant.context';

// Interfaces
import {
  ICustomGoogleMapsLocationBoundsComponentProps,
  ILocationPoint,
  IPlaceSelectedOption,
  IRestaurantDeliveryZoneInfo,
  IRestaurantProfile,
  IRestaurantProfileResponse,
  IUpdateRestaurantDeliveryZoneVariables,
  IZoneResponse,
  IZonesResponse,
} from '@/lib/utils/interfaces';

// Utilities
import { transformPath, transformPolygon } from '@/lib/utils/methods';

// Third-party libraries
import {
  faChevronDown,
  faMapMarker,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import parse from 'autosuggest-highlight/parse';
import { AutoComplete, AutoCompleteSelectEvent } from 'primereact/autocomplete';

// Components
import CustomButton from '../../button';
import CustomRadiusInputField from '../../custom-radius-input';
import CustomShape from '../shapes';
import calculateZoom from '@/lib/utils/methods/zoom-calculator';
import { useTranslations } from 'next-intl';
import { useConfiguration } from '@/lib/hooks/useConfiguration';
import { searchPlaces } from '@/lib/api/google-maps';
import EditableZoneMap from '@/lib/ui/useable-components/leaflet-zone-map/dynamic';

const CustomGoogleMapsLocationBounds: React.FC<
  ICustomGoogleMapsLocationBoundsComponentProps
> = ({ onStepChange, hideControls, height }) => {
  // Context
  const { restaurantLayoutContextData } = useContext(RestaurantLayoutContext);
  const { restaurantId } = restaurantLayoutContextData;
  const { showToast } = useContext(ToastContext);

  // States
  const [zoom, setZoom] = useState(14);
  const [UpdateLocationAddress, setUpdateLocationAddress] = useState('');
  const [deliveryZoneType, setDeliveryZoneType] = useState('point');
  const [center, setCenter] = useState({
    lat: -25.2744, // Central latitude of Australia
    lng: 133.7751, // Central longitude of Australia
  });

  const [marker, setMarker] = useState({
    lat: -25.2744, // Marker at the same central point
    lng: 133.7751, // Marker at the same central point
  });
  const [path, setPath] = useState<ILocationPoint[]>([]);
  const [distance, setDistance] = useState(1);
  // Hooks
  const t = useTranslations();
  const { SERVER_URL } = useConfiguration();

  // States
  const [options, setOptions] = useState<IPlaceSelectedOption[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [selectedPlaceObject, setSelectedPlaceObject] =
    useState<IPlaceSelectedOption | null>(null);
  const [search, setSearch] = useState<string>('');
  const [zones, setZones] = useState<IZoneResponse[]>([]);

  // API
  const { loading: isFetchingRestaurantProfile } = useQuery(
    GET_RESTAURANT_PROFILE,
    {
      variables: { id: restaurantId ?? '' },
      fetchPolicy: 'network-only',
      skip: !restaurantId,
      onCompleted: onRestaurantProfileFetchCompleted,
      onError: onErrorFetchRestaurantProfile,
    }
  );
  const { loading: isFetchingRestaurantDeliveryZoneInfo } = useQuery(
    GET_RESTAURANT_DELIVERY_ZONE_INFO,
    {
      variables: { id: restaurantId ?? '' },
      fetchPolicy: 'network-only',
      skip: !restaurantId,
      onCompleted: onRestaurantZoneInfoFetchCompleted,
      onError: onErrorFetchRestaurantZoneInfo,
    }
  );
  const [updateRestaurantDeliveryZone, { loading: isSubmitting }] = useMutation(
    UPDATE_DELIVERY_BOUNDS_AND_LOCATION,
    {
      update: (cache, { data }) => {
        if (data) {
          updateCache(cache, { data } as IRestaurantProfileResponse);
        }
      },

      onCompleted: onRestaurantZoneUpdateCompleted,
      onError: onErrorLocationZoneUpdate,
    }
  );
  useQuery<IZonesResponse>(GET_ZONES, {
    onCompleted: (data) => {
      if (data) {
        setZones(data.zones);
      }
    },
  });

  // Memos
  const radiusInMeter = useMemo(() => {
    return distance * 1000;
  }, [distance]);
  const fetch = React.useMemo(
    () =>
      throttle(
        async (request: { input: string }, callback: (results: IPlaceSelectedOption[]) => void) => {
          const results = await searchPlaces(SERVER_URL ?? '', request.input);
          callback(results as IPlaceSelectedOption[]);
        },
        1500
      ),
    [SERVER_URL]
  );

  // API Handlers
  function updateCache(
    cache: ApolloCache<unknown>,
    { data }: IRestaurantProfileResponse
  ) {
    const cachedData: IRestaurantProfileResponse | null = cache.readQuery({
      query: GET_RESTAURANT_PROFILE,
      variables: { id: restaurantId ?? '' },
    });
    cache.writeQuery({
      query: GET_RESTAURANT_PROFILE,
      variables: { id: restaurantId ?? '' },
      data: {
        restaurant: {
          ...cachedData?.data?.restaurant,
          ...data?.restaurant,
        },
      },
    });
  }
  // Profile Error
  function onErrorFetchRestaurantProfile({
    graphQLErrors,
    networkError,
  }: ApolloError) {
    showToast({
      type: 'error',
      title: t('Store Profile'),
      message:
        graphQLErrors[0].message ??
        networkError?.message ??
        t('Store Profile Fetch Failed'),
      duration: 2500,
    });
  }
  // Restaurant Profile Complete
  function onRestaurantProfileFetchCompleted({
    restaurant,
  }: {
    restaurant: IRestaurantProfile;
  }) {
    const isLocationZero =
      +restaurant?.location?.coordinates[0] === 0 &&
      +restaurant?.location?.coordinates[1] === 0;
    if (!restaurant || isLocationZero) return;

    setCenter({
      lat: +restaurant?.location?.coordinates[1],
      lng: +restaurant?.location?.coordinates[0],
    });
    setMarker({
      lat: +restaurant?.location?.coordinates[1],
      lng: +restaurant?.location?.coordinates[0],
    });
    setPath(
      restaurant?.deliveryBounds
        ? transformPolygon(restaurant?.deliveryBounds?.coordinates[0])
        : path
    );
  }
  // Restaurant Zone Info Error
  function onErrorFetchRestaurantZoneInfo({
    graphQLErrors,
    networkError,
  }: ApolloError) {
    showToast({
      type: 'error',
      title: t('Store Location & Zone'),
      message:
        graphQLErrors[0].message ??
        networkError?.message ??
        t('Store Location & Zone fetch failed'),
      duration: 2500,
    });
  }
  // Restaurant Zone Info Complete
  function onRestaurantZoneInfoFetchCompleted({
    getRestaurantDeliveryZoneInfo,
  }: {
    getRestaurantDeliveryZoneInfo: IRestaurantDeliveryZoneInfo;
  }) {
    const {
      deliveryBounds: polygonBounds,
      circleBounds,
      location,
      boundType,
    } = getRestaurantDeliveryZoneInfo;

    const coordinates = {
      lng: location.coordinates[0],
      lat: location.coordinates[1],
    };

    const isLocationZero =
      +location?.coordinates[0] === 0 && +location?.coordinates[1] === 0;

    if (!isLocationZero) {
      setCenter(coordinates);
      setMarker(coordinates);
    }

    if (boundType) setDeliveryZoneType(boundType);
    if (circleBounds?.radius) setDistance(circleBounds?.radius);

    setPath(
      polygonBounds?.coordinates[0].map((coordinate: number[]) => {
        return { lat: coordinate[1], lng: coordinate[0] };
      }) || []
    );
  }
  // Zone Update Error
  function onErrorLocationZoneUpdate({
    graphQLErrors,
    networkError,
  }: ApolloError) {
    showToast({
      type: 'error',
      title: t('Store Location & Zone'),
      message:
        graphQLErrors[0].message ??
        networkError?.message ??
        t('Store Location & Zone update failed'),
      duration: 2500,
    });
  }
  // Zone Update Complete
  function onRestaurantZoneUpdateCompleted({
    restaurant,
  }: {
    restaurant: IRestaurantProfile;
  }) {
    if (restaurant) {
      setCenter({
        lat: +restaurant?.location?.coordinates[1],
        lng: +restaurant?.location?.coordinates[0],
      });
      setMarker({
        lat: +restaurant?.location?.coordinates[1],
        lng: +restaurant?.location?.coordinates[0],
      });
      setPath(
        restaurant?.deliveryBounds
          ? transformPolygon(restaurant?.deliveryBounds?.coordinates[0])
          : path
      );
    }

    showToast({
      type: 'success',
      title: t('Zone Update'),
      message: `${t('Store Zone has been updated successfully')}.`,
    });

    if (onStepChange) onStepChange(2);
    // onSetRestaurantsContextData({} as IRestaurantsContextPropData);
    // onSetRestaurantFormVisible(false);
  }

  // Other Handlers
  const handleInputChange = (value: string) => {
    setInputValue(value);
  };
  const onHandlerAutoCompleteSelectionChange = (
    event: AutoCompleteSelectEvent
  ) => {
    const selectedOption = event?.value as IPlaceSelectedOption;
    if (selectedOption && selectedOption.lat != null && selectedOption.lon != null) {
      const location = { lat: selectedOption.lat, lng: selectedOption.lon };

      setUpdateLocationAddress(selectedOption.description);

      setCenter(location);
      setMarker(location);
      setInputValue(selectedOption?.description ?? '');
      setSelectedPlaceObject(selectedOption);
    }
  };
  const onClickGoogleMaps = (lat: number, lng: number) => {
    setPath([...path, { lat, lng }]);
  };
  const getPolygonPathFromCircle = (center: ILocationPoint, radius: number) => {
    try {
      const points = 4;
      const angleStep = (2 * Math.PI) / points;
      const path = [];

      for (let i = 0; i < points; i++) {
        const angle = i * angleStep;
        const lat = center.lat + (radius / 111300) * Math.cos(angle);
        const lng =
          center.lng +
          (radius / (111300 * Math.cos(center.lat * (Math.PI / 180)))) *
            Math.sin(angle);
        path.push({ lat, lng });
      }

      return path;
    } catch (error) {
      return [];
    }
  };
  function getPolygonPath(
    center: ILocationPoint,
    radius: number,
    numPoints: number = 4
  ) {
    try {
      const path = [];

      for (let i = 0; i < numPoints; i++) {
        const angle = (i * 2 * Math.PI) / numPoints;
        const lat = center.lat + (radius / 111320) * Math.cos(angle);
        const lng =
          center.lng +
          (radius / (111320 * Math.cos((center.lat * Math.PI) / 180))) *
            Math.sin(angle);
        path.push([lng, lat]);
      }

      path.push(path[0]);
      return [path];
    } catch (error) {
      return [];
    }
  }
  const handleDistanceChange = (val: number) => {
    const newDistance = val || 0;
    setDistance(newDistance);
  };
  const onVertexDragEnd = (index: number, lat: number, lng: number) => {
    const nextPath = path.map((point, i) => (i === index ? { lat, lng } : point));
    setPath(nextPath);
    const newCenter = nextPath.reduce(
      (acc, point) => ({
        lat: acc.lat + point.lat / nextPath.length,
        lng: acc.lng + point.lng / nextPath.length,
      }),
      { lat: 0, lng: 0 }
    );
    setCenter(newCenter);
    setMarker(newCenter);
  };
  const onCenterDragEnd = (lat: number, lng: number) => {
    const newLatLng = { lat, lng };
    setMarker(newLatLng);
    setCenter(newLatLng);

    // Update polygon when marker is dragged
    if (deliveryZoneType === 'polygon') {
      const newPath = getPolygonPathFromCircle(newLatLng, radiusInMeter ?? 1);
      setPath(newPath);
    }
  };
  // Submit Handler
  const onLocationSubmitHandler = () => {
    try {
      if (!restaurantId) {
        showToast({
          type: 'error',
          title: t('Location & Zone'),
          message: t('No restaurnat is selected'),
        });

        return;
      }

      const location = {
        latitude: marker?.lat ?? 0,
        longitude: marker?.lng ?? 0,
      };

      let bounds = transformPath(path);
      if (deliveryZoneType === 'radius') {
        bounds = getPolygonPath(center, radiusInMeter);
      }

      let variables: IUpdateRestaurantDeliveryZoneVariables = {
        id: restaurantId ?? '',
        location,
        boundType: deliveryZoneType,
        address: UpdateLocationAddress,
        bounds: [[[]]],
      };

      variables = {
        ...variables,
        bounds,
        circleBounds: {
          radius: distance, // Convert kilometers to meters
        },
      };

      updateRestaurantDeliveryZone({ variables: variables });
    } catch (error) {
      showToast({
        type: 'error',
        title: t('Location & Zone'),
        message: t('Location & Zone update failed'),
      });
    }
  };

  // Use Effects
  useEffect(() => {
    let active = true;

    if (search === '') {
      setOptions(selectedPlaceObject ? [selectedPlaceObject] : []);
      return undefined;
    }

    fetch({ input: search }, (results: IPlaceSelectedOption[]) => {
      if (active) {
        let newOptions: IPlaceSelectedOption[] = [];
        if (selectedPlaceObject) {
          newOptions = [selectedPlaceObject];
        }
        if (results) {
          newOptions = [...newOptions, ...results];
        }
        setOptions(newOptions);
      }
    });

    return () => {
      active = false;
    };
  }, [selectedPlaceObject, search, fetch]);

  useEffect(() => {
    const zoomVal = calculateZoom(distance);
    setZoom(zoomVal);
  }, [distance, zoom]);

  return (
    <div>
      <div className="relative overflow-hidden">
        <div
          style={{ height: height }}
          className="h-[600px] w-full object-cover"
        >
          {!hideControls && (
            <div className="absolute left-0 right-0 top-0 z-10">
              <div
                className={`flex w-full flex-col justify-center gap-y-1 p-2`}
              >
                <div className="relative">
                  <AutoComplete
                    id="google-map"
                    disabled={
                      isFetchingRestaurantDeliveryZoneInfo ||
                      isFetchingRestaurantProfile
                    }
                    className={`p h-11 w-full border border-gray-300 px-2 text-sm focus:shadow-none focus:outline-none`}
                    value={inputValue}
                    dropdownIcon={
                      <FontAwesomeIcon
                        icon={faChevronDown}
                        style={{ fontSize: '1rem', color: 'gray' }}
                      />
                    }
                    completeMethod={(event) => {
                      setSearch(event.query);
                    }}
                    onChange={(e) => {
                      if (typeof e.value === 'string')
                        handleInputChange(e.value);
                    }}
                    onSelect={onHandlerAutoCompleteSelectionChange}
                    suggestions={options}
                    forceSelection={false}
                    dropdown={true}
                    multiple={false}
                    loadingIcon={null}
                    placeholder={t('Search Address')}
                    style={{ width: '100%' }}
                    itemTemplate={(item) => {
                      const matches =
                        item.structured_formatting
                          ?.main_text_matched_substrings;
                      let parts = null;
                      if (matches) {
                        parts = parse(
                          item.structured_formatting.main_text,
                          matches.map(
                            (match: { offset: number; length: number }) => [
                              match.offset,
                              match.offset + match.length,
                            ]
                          )
                        );
                      }

                      return (
                        <div className="flex flex-col">
                          <div className="flex items-center">
                            <FontAwesomeIcon
                              icon={faMapMarker}
                              className="mr-2"
                            />
                            {parts &&
                              parts.map((part, index) => (
                                <span
                                  key={index}
                                  style={{
                                    fontWeight: part.highlight ? 700 : 400,
                                    marginRight: '2px',
                                  }}
                                >
                                  {part.text}
                                </span>
                              ))}
                          </div>
                          <small>
                            {item.structured_formatting?.secondary_text}
                          </small>
                        </div>
                      );
                    }}
                  />
                  <div className="absolute right-8 top-0 flex h-full items-center pr-2">
                    {inputValue && (
                      <FontAwesomeIcon
                        icon={faTimes}
                        className="mr-2 cursor-pointer text-gray-400"
                        onClick={() => {
                          setInputValue('');
                          setSearch('');
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <EditableZoneMap
            mode={deliveryZoneType === 'radius' ? 'radius' : deliveryZoneType === 'point' ? 'point' : 'polygon'}
            center={center}
            path={path}
            radiusMeters={radiusInMeter}
            zoom={zoom}
            height="100%"
            onMapClick={deliveryZoneType === 'point' ? onClickGoogleMaps : undefined}
            onVertexDragEnd={onVertexDragEnd}
            showCenterMarker={!!marker}
            onCenterDragEnd={!hideControls ? onCenterDragEnd : undefined}
            referenceZones={(zones ?? [])
              .filter((zone) => zone.location)
              .map((zone) => ({
                id: zone._id,
                path: zone.location!.coordinates[0].map((coord: number[]) => ({
                  lat: coord[1],
                  lng: coord[0],
                })),
              }))}
          />
        </div>
      </div>

      {!hideControls && (
        <>
          {/* Radius Input */}
          {deliveryZoneType === 'radius' && (
            <div className="mt-2 w-[8rem]">
              <CustomRadiusInputField
                type="number"
                name="radius"
                placeholder={t('Radius')}
                maxLength={35}
                min={0}
                // max={100}
                value={distance}
                onChange={handleDistanceChange}
                showLabel={true}
                loading={false}
              />
            </div>
          )}

          {/* Shapes */}
          <CustomShape
            selected={deliveryZoneType}
            onClick={(val: string) => {
              switch (val) {
                case 'polygon':
                  setPath(getPolygonPathFromCircle(center, radiusInMeter));
                  break;
                case 'point':
                  setPath([]);
                  break;
                default:
                  break;
              }

              setDeliveryZoneType(val);
            }}
          />

          <div className="mt-4 flex justify-end">
            <CustomButton
              className="h-10 w-fit dark:border-dark-600 border border-gray-300 bg-black px-8 text-white"
              label={t('Save')}
              type="button"
              loading={isSubmitting}
              onClick={onLocationSubmitHandler}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default CustomGoogleMapsLocationBounds;
