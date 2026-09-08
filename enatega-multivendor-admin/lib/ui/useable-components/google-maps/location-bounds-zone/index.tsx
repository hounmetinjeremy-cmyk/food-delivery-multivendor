'use client';

// Core imports
import React, {
  useContext,
  useEffect,
  useState,
} from 'react';
import parse from 'autosuggest-highlight/parse';
import { throttle } from '@/lib/utils/methods';

// Interfaces
import {
  ILocationPoint,
  IPlaceSelectedOption,
  IZoneCustomGoogleMapsBoundComponentProps,
} from '@/lib/utils/interfaces';

// Utilities
import {
  calculatePolygonCentroid,
  transformPath,
  transformPolygon,
} from '@/lib/utils/methods';

// Third-party libraries
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChevronDown,
  faMapMarker,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';

// Prime React
import { AutoComplete, AutoCompleteSelectEvent } from 'primereact/autocomplete';
import { GoogleMapsContext } from '@/lib/context/global/google-maps.context';
import CustomShape from '../shapes';
import { DEFAULT_CENTER, DEFAULT_POLYGON } from '@/lib/utils/constants';
import { useTranslations } from 'next-intl';
import { useConfiguration } from '@/lib/hooks/useConfiguration';
import { searchPlaces } from '@/lib/api/google-maps';
import EditableZoneMap from '@/lib/ui/useable-components/leaflet-zone-map/dynamic';

const CustomGoogleMapsLocationZoneBounds: React.FC<
  IZoneCustomGoogleMapsBoundComponentProps
> = ({ _path, onSetZoneCoordinates }) => {
  // Hooks
  const t = useTranslations();
  const { SERVER_URL } = useConfiguration();

  // Context
  const googleMapsContext = useContext(GoogleMapsContext);

  // States
  const [isMounted, setIsMounted] = useState(false);
  const [deliveryZoneType, setDeliveryZoneType] = useState('polygon');
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [path, setPath] = useState<ILocationPoint[]>(DEFAULT_POLYGON);

  // Auto complete
  const [options, setOptions] = useState<IPlaceSelectedOption[]>([]);
  const [inputValue, setInputValue] = useState<string>('');
  const [selectedPlaceObject, setSelectedPlaceObject] =
    useState<IPlaceSelectedOption | null>(null);
  const [search, setSearch] = useState<string>('');
  const [lastSelectedLocation, setLastSelectedLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

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

  // Helper to create a polygon around a point
  const createPolygonAroundPoint = (
    center: { lat: number; lng: number },
    sizeMeters = 100
  ): ILocationPoint[] => {
    const latOffset = sizeMeters * 0.0000089;
    const lngOffset =
      (sizeMeters * 0.0000089) / Math.cos((center.lat * Math.PI) / 180);
    return [
      { lat: center.lat + latOffset, lng: center.lng - lngOffset },
      { lat: center.lat + latOffset, lng: center.lng + lngOffset },
      { lat: center.lat - latOffset, lng: center.lng + lngOffset },
      { lat: center.lat - latOffset, lng: center.lng - lngOffset },
      { lat: center.lat + latOffset, lng: center.lng - lngOffset },
    ];
  };

  // Handlers
  const handleInputChange = (value: string) => {
    setInputValue(value);
  };

  const onHandlerAutoCompleteSelectionChange = (
    event: AutoCompleteSelectEvent
  ) => {
    const selectedOption = event?.value as IPlaceSelectedOption;
    if (selectedOption && selectedOption.lat != null && selectedOption.lon != null) {
      const centerPoint = { lat: selectedOption.lat, lng: selectedOption.lon };
      setCenter(centerPoint);
      setLastSelectedLocation(centerPoint);

      if (deliveryZoneType === 'polygon') {
        setPath(createPolygonAroundPoint(centerPoint));
      } else if (deliveryZoneType === 'point') {
        setPath([centerPoint]);
      }

      setInputValue(selectedOption.description);
      setSelectedPlaceObject(selectedOption);
    }
  };

  const onMapClick = (lat: number, lng: number) => {
    if (deliveryZoneType === 'point') {
      setPath([{ lat, lng }]);
    } else {
      setPath([...path, { lat, lng }]);
    }
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
  };

  const onSetCenterAndPolygon = () => {
    if (
      Array.isArray(_path) &&
      _path.length > 0 &&
      Array.isArray(_path[0]) &&
      _path[0].length > 0 &&
      _path[0][0].length > 0
    ) {
      setPath(transformPolygon(_path[0]));
      setCenter(calculatePolygonCentroid(_path[0]));
    }
  };

  // Use Effects
  useEffect(() => {
    if (!isMounted) return;
    onSetZoneCoordinates(transformPath(path ?? []));
  }, [path, isMounted]);

  useEffect(() => {
    if (search === '') {
      setOptions(selectedPlaceObject ? [selectedPlaceObject] : []);
      return;
    }

    fetch({ input: search }, (results: IPlaceSelectedOption[]) => {
      let newOptions: IPlaceSelectedOption[] = [];
      if (selectedPlaceObject) {
        newOptions = [selectedPlaceObject];
      }
      if (results) {
        newOptions = [...newOptions, ...results];
      }
      setOptions(newOptions);
    });
  }, [selectedPlaceObject, search, fetch]);

  useEffect(() => {
    onSetCenterAndPolygon();
    setIsMounted(true);
  }, []);

  return (
    <div>
      <div className="relative overflow-hidden">
        <div className="h-[600px] w-full object-cover">
          <div className="absolute left-0 right-0 top-0 z-10">
            <div className={`flex w-full flex-col justify-center gap-y-1 p-2`}>
              <div className="relative">
                <AutoComplete
                  id="google-map"
                  disabled={false}
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
                    if (typeof e.value === 'string') handleInputChange(e.value);
                  }}
                  onSelect={onHandlerAutoCompleteSelectionChange}
                  suggestions={options}
                  forceSelection={false}
                  dropdown={true}
                  multiple={false}
                  loadingIcon={null}
                  placeholder={t('Enter your full address')}
                  style={{ width: '100%' }}
                  itemTemplate={(item) => {
                    const matches =
                      item.structured_formatting?.main_text_matched_substrings;
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

          {googleMapsContext?.isLoaded && (
            <EditableZoneMap
              mode={deliveryZoneType === 'point' ? 'point' : 'polygon'}
              center={center}
              path={path}
              zoom={14}
              onMapClick={onMapClick}
              onVertexDragEnd={onVertexDragEnd}
              onPointDragEnd={(lat, lng) => setPath([{ lat, lng }])}
            />
          )}
        </div>
      </div>

      <CustomShape
        selected={deliveryZoneType}
        hidenNames={['radius']}
        onClick={(val: string) => {
          setDeliveryZoneType(val);
          if (lastSelectedLocation) {
            if (val === 'polygon') {
              setPath(createPolygonAroundPoint(lastSelectedLocation));
            } else if (val === 'point') {
              setPath([lastSelectedLocation]);
            }
          } else {
            switch (val) {
              case 'polygon':
                setPath(DEFAULT_POLYGON);
                break;
              case 'point':
                setPath([]);
                break;
              default:
                break;
            }
          }
        }}
      />
    </div>
  );
};

export default CustomGoogleMapsLocationZoneBounds;
