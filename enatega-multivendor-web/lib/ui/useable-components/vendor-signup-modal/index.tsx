"use client";

import { useTranslations } from "next-intl";
import CustomDialog from "@/lib/ui/useable-components/custom-dialog";
import EmailForm from "@/lib/ui/useable-components/RiderandRestaurantsInfos/Form";

interface IVendorSignupModalProps {
  visible: boolean;
  onHide: () => void;
}

// Same registration form as the "Devenir vendeur" marketing page (see
// RestaurantInfo), without the marketing content — a quick, one-step request
// reachable from the Profile hub instead of leaving the app for the admin
// site's own sign-up.
export default function VendorSignupModal({
  visible,
  onHide,
}: IVendorSignupModalProps) {
  const t = useTranslations();

  return (
    <CustomDialog visible={visible} onHide={onHide} width="500px">
      <EmailForm
        heading={t("become_a_restaurant")}
        role={t("vendor_registration")}
        requestType="vendor"
      />
    </CustomDialog>
  );
}
