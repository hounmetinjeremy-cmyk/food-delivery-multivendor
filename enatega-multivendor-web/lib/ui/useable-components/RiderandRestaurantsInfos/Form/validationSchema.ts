import * as Yup from "yup";

// When the visitor is already signed in with Google, their name/email/password
// are dropped from the form entirely (see index.tsx) — validating them here
// too would just block a submit that doesn't send those fields at all.
const emailValidationSchema = (
  t: (key: string) => string,
  isAuthenticated = false,
  requestType: "rider" | "vendor" = "rider",
) =>
  Yup.object({
    firstName: isAuthenticated
      ? Yup.string()
      : Yup.string().required(t("firstNameRequired")),
    lastName: isAuthenticated
      ? Yup.string()
      : Yup.string().required(t("lastNameRequired")),
    phoneNumber: Yup.string()
      .matches(/^\+?[0-9]{7,15}$/, t("phoneNumberInvalid"))
      .required(t("phoneNumberRequired")),
    email: isAuthenticated
      ? Yup.string().email(t("emailInvalid"))
      : Yup.string().email(t("emailInvalid")).required(t("emailRequired")),
    password: isAuthenticated
      ? Yup.string()
      : Yup.string().min(6, t("passwordMin")).required(t("passwordRequired")),
    confirmPassword: isAuthenticated
      ? Yup.string()
      : Yup.string()
          .oneOf([Yup.ref("password")], t("confirmPasswordMismatch"))
          .required(t("confirmPasswordRequired")),
    termsAccepted: Yup.boolean().oneOf([true], t("termsRequired")),
    restaurantName:
      requestType === "vendor"
        ? Yup.string().required("Le nom de la boutique est requis")
        : Yup.string(),
  });

export default emailValidationSchema;
