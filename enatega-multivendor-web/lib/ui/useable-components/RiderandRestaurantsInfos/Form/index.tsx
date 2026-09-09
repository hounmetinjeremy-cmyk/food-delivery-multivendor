"use client";

// formik imports
import { Formik, Form, Field, ErrorMessage } from "formik";

// Components from primeReact
import { InputText } from "primereact/inputtext";
import { Password } from "primereact/password";
import { Checkbox } from "primereact/checkbox";
import { Button } from "primereact/button";

// libraries and utils
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import "react-phone-input-2/lib/style.css";
import {
  zegoApiFetch,
  setZegoApiToken,
  getZegoApiUserId,
} from "@/lib/zego-api/client";
import { APK_DOWNLOAD_URL } from "@/lib/utils/constants/apk";

// interfcaes
import { VendorFormValues } from "@/lib/utils/interfaces/Rider-restaurant.interface";

// component
import PhoneNumberInput from "./phoneNumberInput/PhoneNumberInput";

// validation Schema
import emailValidationSchema from "./validationSchema";

// hooks
import useToast from "@/lib/hooks/useToast";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/context/auth/auth.context";

interface formProps {
  heading: string;
  role: string;
  requestType: "rider" | "vendor";
}

const SUBMIT_PARTNER_REQUEST_MUTATION = /* GraphQL */ `
  mutation SubmitPartnerRequest($input: PartnerRequestInput!) {
    submitPartnerRequest(input: $input) {
      success
      token
      role
    }
  }
`;

interface SubmitPartnerRequestResponse {
  submitPartnerRequest: {
    success: boolean;
    token: string | null;
    role: string | null;
  };
}

const ME_QUERY = /* GraphQL */ `
  query Me {
    me {
      email
      phone
      name
    }
  }
`;

interface MeResponse {
  me: { email: string | null; phone: string | null; name: string };
}

const EmailForm: React.FC<formProps> = ({ heading, role, requestType }) => {
  const { showToast } = useToast();
  const router = useRouter();
  const t = useTranslations();
  // Already signed in with Google (the normal case when this form is opened
  // from Profile)? Then we already know who they are — don't make them
  // retype their name/email or invent a separate password for this account.
  // The legacy auth context is checked first, but it isn't always populated
  // right after a Google sign-in — the zego-api session (which powers the
  // Livreur/Messagerie tabs) is the reliable source, so fall back to it via
  // its own `me` query.
  const { user } = useAuth();
  const hasZegoSession = Boolean(getZegoApiUserId());
  const [zegoMe, setZegoMe] = useState<MeResponse["me"] | null>(null);
  const [isZegoMeLoading, setIsZegoMeLoading] = useState(hasZegoSession);

  useEffect(() => {
    if (!hasZegoSession) return;
    zegoApiFetch<MeResponse>(ME_QUERY)
      .then((data) => setZegoMe(data.me))
      .catch(() => setZegoMe(null))
      .finally(() => setIsZegoMeLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const effectiveEmail = user?.email ?? zegoMe?.email ?? "";
  const effectiveName = user?.name ?? zegoMe?.name ?? "";
  const effectivePhone = user?.phone ?? zegoMe?.phone ?? "";
  const isAuthenticated = Boolean(effectiveEmail);
  // Waiting on the zego-api profile and nothing else has already confirmed
  // who's asking — avoid flashing the full signup form only to swap it out
  // a moment later once the session resolves.
  const isCheckingSession = isZegoMeLoading && !user?.email;

  const initialValues: VendorFormValues = {
    firstName: effectiveName.split(" ")[0] ?? "",
    lastName: effectiveName.split(" ").slice(1).join(" ") ?? "",
    phoneNumber: effectivePhone,
    email: effectiveEmail,
    password: "",
    confirmPassword: "",
    termsAccepted: false,
    restaurantName: "",
  };

  const handleSubmit = async (formData: VendorFormValues) => {
    try {
      const { submitPartnerRequest } =
        await zegoApiFetch<SubmitPartnerRequestResponse>(
          SUBMIT_PARTNER_REQUEST_MUTATION,
          {
            input: isAuthenticated
              ? {
                  requestType,
                  phone: formData.phoneNumber,
                  ...(requestType === "vendor"
                    ? { restaurantName: formData.restaurantName }
                    : {}),
                }
              : {
                  requestType,
                  firstName: formData.firstName,
                  lastName: formData.lastName,
                  email: formData.email,
                  phone: formData.phoneNumber,
                  password: formData.password,
                  ...(requestType === "vendor"
                    ? { restaurantName: formData.restaurantName }
                    : {}),
                },
          },
        );

      // Upgraded in place to a rider/vendor account — refresh the session
      // token so the app recognizes the new role immediately, no re-login.
      if (submitPartnerRequest.token) {
        setZegoApiToken(submitPartnerRequest.token);
      }

      showToast({
        type: "success",
        title: t("toast_success"),
        message:
          requestType === "rider" && isAuthenticated
            ? t("you_are_now_a_rider_message")
            : requestType === "vendor" && submitPartnerRequest.token
              ? "Votre boutique est prête !"
              : t("form_submitted_successfully"),
        duration: 4000,
      });

      // A vendor with a fresh token is instantly active — take them straight
      // to their dashboard instead of the home page.
      if (requestType === "vendor" && submitPartnerRequest.token) {
        router.push("/profile/dashboard");
      } else {
        router.push("/");
      }
    } catch (error) {
      console.error(`Failed to submit ${role} request:`, error);

      showToast({
        type: "error",
        title: t("toast_error"),
        message:
          error instanceof Error && error.message
            ? error.message
            : t("failed_to_submit_form_please_try_again"),
        duration: 4000,
      });
    }
  };

  // Live GPS tracking can't run reliably in a plain browser tab, so becoming
  // a rider requires the native APK — send them to install/open it instead
  // of filling out this form on the website.
  if (requestType === "rider" && !Capacitor.isNativePlatform()) {
    return (
      <div className="p-6 max-w-xl mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-m my-6 text-center">
        <h2 className="text-[20px] font-semibold mb-3 dark:text-gray-100">
          {heading}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
          Le mode livreur nécessite l&apos;application mobile ZeGo (GPS et
          suivi en temps réel), qui ne peut pas fonctionner de manière fiable
          dans un simple site web.
        </p>
        <a
          href={APK_DOWNLOAD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-primary-color text-white font-medium px-6 py-2 rounded-full hover:bg-primary-color transition-all"
        >
          Télécharger l&apos;application
        </a>
      </div>
    );
  }

  if (isCheckingSession) {
    return (
      <div className="p-6 max-w-xl mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-m my-6 text-center text-sm text-gray-500 dark:text-gray-400">
        {t("loading_orders")}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-m my-6">
      <h2 className="text-[20px] font-semibold mb-6 dark:text-gray-100">
        {heading}
      </h2>

      <Formik
        initialValues={initialValues}
        validationSchema={emailValidationSchema(t, isAuthenticated, requestType)}
        onSubmit={handleSubmit}
        enableReinitialize
      >
        {({ values, setFieldValue, isSubmitting }) => (
          <Form className="grid gap-5">
            {isAuthenticated ? (
              /* Already signed in with Google — show who's requesting instead
                 of asking them to retype their identity. */
              <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-3 text-sm dark:text-gray-200">
                <p>{t("signed_in_with_google_message")}</p>
                <p className="font-medium mt-1">
                  {effectiveName} · {effectiveEmail}
                </p>
              </div>
            ) : (
              <>
                {/* First and Last Name */}
                <div className="gap-4 flex w-[100%] justify-between">
                  <div className="w-[50%]">
                    <label className="text-sm dark:text-gray-300">
                      {t("first_name_label")}
                    </label>
                    <Field name="firstName">
                      {({ field }: any) => (
                        <InputText
                          placeholder={t("first_name_label")}
                          {...field}
                          className="w-full text-sm border-2 border-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 p-2 rounded-lg"
                        />
                      )}
                    </Field>
                    <ErrorMessage
                      name="firstName"
                      component="small"
                      className="p-error text-sm"
                    />
                  </div>

                  <div className="w-[50%]">
                    <label className="text-sm dark:text-gray-300">
                      {t("last_name_label")}
                    </label>
                    <Field name="lastName">
                      {({ field }: any) => (
                        <InputText
                          placeholder={t("last_name_label")}
                          {...field}
                          className="w-full border-2 text-sm border-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 p-2 rounded-lg"
                        />
                      )}
                    </Field>
                    <ErrorMessage
                      name="lastName"
                      component="small"
                      className="p-error text-sm"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="text-sm dark:text-gray-300">
                    {t("email_label")}
                  </label>
                  <Field name="email">
                    {({ field }: any) => (
                      <InputText
                        placeholder={t("email_address_placeholder")}
                        {...field}
                        className="w-full border-2 text-sm border-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 p-2 rounded-lg"
                      />
                    )}
                  </Field>
                  <ErrorMessage
                    name="email"
                    component="small"
                    className="p-error text-sm"
                  />
                </div>
              </>
            )}

            {requestType === "vendor" && (
              <div>
                <label className="text-sm dark:text-gray-300">
                  Nom de la boutique
                </label>
                <Field name="restaurantName">
                  {({ field }: any) => (
                    <InputText
                      placeholder="Nom de la boutique"
                      {...field}
                      className="w-full text-sm border-2 border-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 p-2 rounded-lg"
                    />
                  )}
                </Field>
                <ErrorMessage
                  name="restaurantName"
                  component="small"
                  className="p-error text-sm"
                />
              </div>
            )}

            {/* Phone Number */}
            <div>
              <label className="text-sm dark:text-gray-300">
                {t("phone_label")}
              </label>
              <PhoneNumberInput />
              <ErrorMessage
                name="phoneNumber"
                component="small"
                className="p-error text-sm  "
              />
            </div>

            {!isAuthenticated && (
              <>
                {/* Password */}
                <div>
                  <label className="text-sm dark:text-gray-300">
                    {t("password_label")}
                  </label>
                  <Field name="password">
                    {({ field }: any) => (
                      <Password
                        {...field}
                        inputClassName="bg-white text-black dark:bg-gray-700 dark:text-white"
                        panelClassName="bg-white text-black dark:bg-gray-700 dark:text-white"
                        placeholder={t("password")}
                        toggleMask
                        className="w-full text-sm border-2 border-gray-200 dark:border-gray-600 p-2 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        feedback={false}
                      />
                    )}
                  </Field>
                  <ErrorMessage
                    name="password"
                    component="small"
                    className="p-error text-sm"
                  />
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="text-sm dark:text-gray-300">
                    {t("confirm_password_label")}
                  </label>
                  <Field name="confirmPassword">
                    {({ field }: any) => (
                      <Password
                        placeholder={t("confirm_password_label")}
                        inputClassName="bg-white text-black dark:bg-gray-700 dark:text-white"
                        panelClassName="bg-white text-black dark:bg-gray-700 dark:text-white"
                        {...field}
                        toggleMask
                        className="w-full text-sm border-2 border-gray-200 dark:border-gray-600 p-2 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        feedback={false}
                      />
                    )}
                  </Field>
                  <ErrorMessage
                    name="confirmPassword"
                    component="small"
                    className="p-error text-sm"
                  />
                </div>
              </>
            )}

            {/* Terms & Conditions */}
            <div className="flex items-center gap-2 h-[40px]">
              <Checkbox
                inputId="termsAccepted"
                checked={values.termsAccepted}
                onChange={(e) => setFieldValue("termsAccepted", e.checked)}
                className="border-gray-400 dark:border-gray-600 dark:bg-gray-700"
              />
              <label
                className="text-sm text-gray-800 dark:text-gray-300"
                htmlFor="termsAccepted"
              >
                {t("i_accept_the_terms_and_conditions")}
              </label>
            </div>
            <ErrorMessage
              name="termsAccepted"
              component="small"
              className="p-error text-sm"
            />

            {/* Submit Button */}
            <div className="flex justify-center items-center">
              <Button
                type="submit"
                label={t("register_label")}
                loading={isSubmitting}
                className="mt-4 bg-primary-color text-[16px] font-medium w-[200px] p-2 rounded-full text-white  hover:bg-primary-color transition-all"
              />
            </div>
          </Form>
        )}
      </Formik>
    </div>
  );
};

export default EmailForm;
