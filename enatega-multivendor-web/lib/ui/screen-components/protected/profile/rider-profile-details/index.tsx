"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getZegoApiUserId,
  getZegoApiUserRole,
  zegoApiFetch,
} from "@/lib/zego-api/client";

interface WorkScheduleSlot {
  startTime: string;
  endTime: string;
}

interface WorkScheduleDay {
  day: string;
  enabled: boolean;
  slots: WorkScheduleSlot[];
}

interface RiderProfileDetails {
  vehicleType: string | null;
  vehicleDetails: { number: string | null; image: string | null } | null;
  licenseDetails: { number: string | null; expiryDate: string | null; image: string | null } | null;
  bussinessDetails: {
    bankName: string | null;
    accountName: string | null;
    accountCode: string | null;
    accountNumber: string | null;
  } | null;
  timeZone: string | null;
  workSchedule: WorkScheduleDay[];
}

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

const RIDER_PROFILE_DETAILS_QUERY = /* GraphQL */ `
  query RiderProfileDetails($id: String!) {
    rider(id: $id) {
      vehicleType
      vehicleDetails {
        number
        image
      }
      licenseDetails {
        number
        expiryDate
        image
      }
      bussinessDetails {
        bankName
        accountName
        accountCode
        accountNumber
      }
      timeZone
      workSchedule {
        day
        enabled
        slots {
          startTime
          endTime
        }
      }
    }
  }
`;

const UPLOAD_IMAGE_MUTATION = /* GraphQL */ `
  mutation UploadImageToS3($image: String!) {
    uploadImageToS3(image: $image) {
      imageUrl
    }
  }
`;

const UPDATE_VEHICLE_MUTATION = /* GraphQL */ `
  mutation UpdateRiderVehicleDetails(
    $id: String!
    $vehicleType: String
    $vehicleDetails: VehicleDetailsInput
  ) {
    updateRiderVehicleDetails(id: $id, vehicleType: $vehicleType, vehicleDetails: $vehicleDetails) {
      _id
    }
  }
`;

const UPDATE_LICENSE_MUTATION = /* GraphQL */ `
  mutation UpdateRiderLicenseDetails($id: String!, $licenseDetails: LicenseDetailsInput) {
    updateRiderLicenseDetails(id: $id, licenseDetails: $licenseDetails) {
      _id
    }
  }
`;

const UPDATE_BANK_MUTATION = /* GraphQL */ `
  mutation UpdateRiderBussinessDetails($id: String!, $bussinessDetails: BussinessDetailsInput) {
    updateRiderBussinessDetails(id: $id, bussinessDetails: $bussinessDetails) {
      _id
    }
  }
`;

const UPDATE_SCHEDULE_MUTATION = /* GraphQL */ `
  mutation UpdateWorkSchedule($riderId: String!, $workSchedule: [DayScheduleInput!]!, $timeZone: String) {
    updateWorkSchedule(riderId: $riderId, workSchedule: $workSchedule, timeZone: $timeZone) {
      _id
    }
  }
`;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const defaultSchedule = (): WorkScheduleDay[] =>
  DAYS.map((day) => ({ day, enabled: false, slots: [{ startTime: "08:00", endTime: "18:00" }] }));

// Mirrors the existing rider app's vehicle-type / bank-management /
// work-schedule screens (its own Profile section) — reused as one combined
// page here since the backing zego-api fields (vehicleDetails,
// licenseDetails, bussinessDetails, workSchedule) were declared from the
// start to match it but had nowhere to store data until this pass.
export default function RiderProfileDetails() {
  const router = useRouter();
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleImage, setVehicleImage] = useState<string | null>(null);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [licenseImage, setLicenseImage] = useState<string | null>(null);
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountCode, setAccountCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [schedule, setSchedule] = useState<WorkScheduleDay[]>(defaultSchedule());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const role = getZegoApiUserRole();
    const riderId = getZegoApiUserId();
    if (role !== "rider" || !riderId) {
      setIsAllowed(false);
      router.replace("/profile");
      return;
    }
    setIsAllowed(true);
    zegoApiFetch<{ rider: RiderProfileDetails | null }>(RIDER_PROFILE_DETAILS_QUERY, {
      id: riderId,
    })
      .then((data) => {
        const rider = data.rider;
        if (!rider) return;
        setVehicleType(rider.vehicleType ?? "");
        setVehicleNumber(rider.vehicleDetails?.number ?? "");
        setVehicleImage(rider.vehicleDetails?.image ?? null);
        setLicenseNumber(rider.licenseDetails?.number ?? "");
        setLicenseExpiry(rider.licenseDetails?.expiryDate ?? "");
        setLicenseImage(rider.licenseDetails?.image ?? null);
        setBankName(rider.bussinessDetails?.bankName ?? "");
        setAccountName(rider.bussinessDetails?.accountName ?? "");
        setAccountCode(rider.bussinessDetails?.accountCode ?? "");
        setAccountNumber(rider.bussinessDetails?.accountNumber ?? "");
        if (rider.workSchedule?.length) setSchedule(rider.workSchedule);
      })
      .finally(() => setIsLoading(false));
  }, [router]);

  const uploadImage = async (
    event: ChangeEvent<HTMLInputElement>,
    onUploaded: (url: string) => void,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    const data = await zegoApiFetch<{ uploadImageToS3: { imageUrl: string } }>(
      UPLOAD_IMAGE_MUTATION,
      { image: dataUrl },
    );
    onUploaded(data.uploadImageToS3.imageUrl);
  };

  const saveVehicle = async () => {
    const riderId = getZegoApiUserId();
    if (!riderId) return;
    setIsSaving("vehicle");
    try {
      await zegoApiFetch(UPDATE_VEHICLE_MUTATION, {
        id: riderId,
        vehicleType,
        vehicleDetails: { number: vehicleNumber, image: vehicleImage },
      });
      setMessage("Véhicule enregistré.");
    } finally {
      setIsSaving(null);
    }
  };

  const saveLicense = async () => {
    const riderId = getZegoApiUserId();
    if (!riderId) return;
    setIsSaving("license");
    try {
      await zegoApiFetch(UPDATE_LICENSE_MUTATION, {
        id: riderId,
        licenseDetails: { number: licenseNumber, expiryDate: licenseExpiry, image: licenseImage },
      });
      setMessage("Permis enregistré.");
    } finally {
      setIsSaving(null);
    }
  };

  const saveBank = async () => {
    const riderId = getZegoApiUserId();
    if (!riderId) return;
    setIsSaving("bank");
    try {
      await zegoApiFetch(UPDATE_BANK_MUTATION, {
        id: riderId,
        bussinessDetails: {
          bankName,
          accountName,
          accountCode,
          accountNumber,
        },
      });
      setMessage("Coordonnées bancaires enregistrées.");
    } finally {
      setIsSaving(null);
    }
  };

  const saveSchedule = async () => {
    const riderId = getZegoApiUserId();
    if (!riderId) return;
    setIsSaving("schedule");
    try {
      await zegoApiFetch(UPDATE_SCHEDULE_MUTATION, {
        riderId,
        workSchedule: schedule,
      });
      setMessage("Horaires enregistrés.");
    } finally {
      setIsSaving(null);
    }
  };

  if (isAllowed === null || !isAllowed) return null;
  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-6 text-sm text-gray-500 dark:text-gray-400">
        Chargement…
      </div>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white";
  const sectionClass = "mb-8 rounded-lg border border-gray-200 p-4 dark:border-gray-700";
  const buttonClass =
    "mt-3 rounded-full bg-primary-color px-4 py-2 text-sm font-medium text-white disabled:opacity-60";

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-semibold text-dispatch-ink dark:text-white">
        Mon profil livreur
      </h1>

      {message && <p className="mb-4 text-sm text-primary-color">{message}</p>}

      <div className={sectionClass}>
        <h2 className="mb-3 text-lg font-semibold dark:text-white">Véhicule</h2>
        <div className="flex flex-col gap-3">
          <input
            className={inputClass}
            placeholder="Type de véhicule (moto, vélo, voiture…)"
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Numéro d'immatriculation"
            value={vehicleNumber}
            onChange={(e) => setVehicleNumber(e.target.value)}
          />
          <input type="file" accept="image/*" onChange={(e) => uploadImage(e, setVehicleImage)} />
          {vehicleImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vehicleImage} alt="Véhicule" className="h-24 w-24 rounded-lg object-cover" />
          )}
        </div>
        <button type="button" onClick={saveVehicle} disabled={isSaving === "vehicle"} className={buttonClass}>
          Enregistrer
        </button>
      </div>

      <div className={sectionClass}>
        <h2 className="mb-3 text-lg font-semibold dark:text-white">Permis</h2>
        <div className="flex flex-col gap-3">
          <input
            className={inputClass}
            placeholder="Numéro de permis"
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
          />
          <input
            type="date"
            className={inputClass}
            value={licenseExpiry}
            onChange={(e) => setLicenseExpiry(e.target.value)}
          />
          <input type="file" accept="image/*" onChange={(e) => uploadImage(e, setLicenseImage)} />
          {licenseImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={licenseImage} alt="Permis" className="h-24 w-24 rounded-lg object-cover" />
          )}
        </div>
        <button type="button" onClick={saveLicense} disabled={isSaving === "license"} className={buttonClass}>
          Enregistrer
        </button>
      </div>

      <div className={sectionClass}>
        <h2 className="mb-3 text-lg font-semibold dark:text-white">Coordonnées bancaires</h2>
        <div className="flex flex-col gap-3">
          <input className={inputClass} placeholder="Banque" value={bankName} onChange={(e) => setBankName(e.target.value)} />
          <input
            className={inputClass}
            placeholder="Nom du titulaire"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Code agence"
            value={accountCode}
            onChange={(e) => setAccountCode(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="Numéro de compte"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
          />
        </div>
        <button type="button" onClick={saveBank} disabled={isSaving === "bank"} className={buttonClass}>
          Enregistrer
        </button>
      </div>

      <div className={sectionClass}>
        <h2 className="mb-3 text-lg font-semibold dark:text-white">Horaires de travail</h2>
        <div className="flex flex-col gap-2">
          {schedule.map((day, index) => (
            <div key={day.day} className="flex items-center gap-3">
              <label className="flex w-28 items-center gap-2 text-sm dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={day.enabled}
                  onChange={(e) => {
                    const next = [...schedule];
                    next[index] = { ...day, enabled: e.target.checked };
                    setSchedule(next);
                  }}
                />
                {day.day}
              </label>
              <input
                type="time"
                className={inputClass}
                value={day.slots[0]?.startTime ?? "08:00"}
                disabled={!day.enabled}
                onChange={(e) => {
                  const next = [...schedule];
                  next[index] = {
                    ...day,
                    slots: [{ ...day.slots[0], startTime: e.target.value }],
                  };
                  setSchedule(next);
                }}
              />
              <input
                type="time"
                className={inputClass}
                value={day.slots[0]?.endTime ?? "18:00"}
                disabled={!day.enabled}
                onChange={(e) => {
                  const next = [...schedule];
                  next[index] = {
                    ...day,
                    slots: [{ ...day.slots[0], endTime: e.target.value }],
                  };
                  setSchedule(next);
                }}
              />
            </div>
          ))}
        </div>
        <button type="button" onClick={saveSchedule} disabled={isSaving === "schedule"} className={buttonClass}>
          Enregistrer
        </button>
      </div>
    </div>
  );
}
