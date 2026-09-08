"use client";

import { useTranslations } from "next-intl";
import CustomDialog from "@/lib/ui/useable-components/custom-dialog";
import EmailForm from "@/lib/ui/useable-components/RiderandRestaurantsInfos/Form";

interface IRiderSignupModalProps {
  visible: boolean;
  onHide: () => void;
}

// Same registration form as the "Devenir livreur" marketing page, without the
// marketing content around it — a quick, one-step signup reachable from the
// Profile hub instead of a full landing page.
export default function RiderSignupModal({
  visible,
  onHide,
}: IRiderSignupModalProps) {
  const t = useTranslations();

  return (
    <CustomDialog visible={visible} onHide={onHide} width="500px">
      <EmailForm
        heading={t("zego_rider_page_name_form_heading")}
        role={t("zego_rider_page_name_form_role")}
        requestType="rider"
      />
    </CustomDialog>
  );
}
