'use client';

// Core
import { Form, Formik } from 'formik';
import { useContext, useState } from 'react';
import * as Yup from 'yup';

// Components
import CustomButton from '@/lib/ui/useable-components/button';
import CusomtTextField from '@/lib/ui/useable-components/input-field';
import CustomIconTextField from '@/lib/ui/useable-components/input-icon-field';

// Icons
import { faEnvelope, faEye } from '@fortawesome/free-solid-svg-icons';

// Prime React
import { Card } from 'primereact/card';
import { Divider } from 'primereact/divider';

// Methods
import { onErrorMessageMatcher } from '@/lib/utils/methods/error';
import { onUseLocalStorage } from '@/lib/utils/methods';
import { setAuthTokens } from '@/lib/utils/methods/auth';

// Contants
import { APP_NAME, PasswordErrors, SignUpErrors } from '@/lib/utils/constants';
import { DEFAULT_ROUTES } from '@/lib/utils/constants/routes';

// Interface
import { ISignUpForm } from '@/lib/utils/interfaces/forms';

// GraphQL
import { gql, useMutation, ApolloError } from '@apollo/client';
import { OWNER_LOGIN } from '@/lib/api/graphql';
import { ToastContext } from '@/lib/context/global/toast.context';

// Hooks
import { useRouter } from 'next/navigation';
import { useUserContext } from '@/lib/hooks/useUser';

const SIGN_UP_VENDOR = gql`
  mutation SignUpVendor($vendorInput: VendorInput) {
    createVendor(vendorInput: $vendorInput) {
      id
    }
  }
`;

const initialValues: ISignUpForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export default function SignupMain() {
  const [account] = useState<ISignUpForm>(initialValues);

  const { showToast } = useContext(ToastContext);
  const router = useRouter();
  const { refreshUserSession } = useUserContext();

  const [createVendor, { loading: creating }] = useMutation(SIGN_UP_VENDOR);
  const [ownerLogin, { loading: loggingIn }] = useMutation(OWNER_LOGIN);

  const SignupSchema = Yup.object().shape({
    firstName: Yup.string().min(2).max(35).required('Required'),
    lastName: Yup.string().min(2).max(35).required('Required'),
    email: Yup.string().email('Invalid email').required('Required'),
    password: Yup.string().required('Required'),
    confirmPassword: Yup.string()
      .nullable()
      .oneOf([Yup.ref('password'), null], 'Password must match')
      .required('Required'),
  });

  const onSubmitHandler = async (values: ISignUpForm) => {
    try {
      await createVendor({
        variables: {
          vendorInput: {
            firstName: values.firstName,
            lastName: values.lastName,
            email: values.email,
            password: values.password,
          },
        },
      });

      const response = await ownerLogin({
        variables: {
          email: values.email,
          password: values.password,
        },
      });

      const ownerSession = response.data?.ownerLogin;
      if (!ownerSession) {
        throw new Error('Unable to load session');
      }

      onUseLocalStorage('save', `user-${APP_NAME}`, JSON.stringify(ownerSession));
      setAuthTokens({
        userId: ownerSession.userId,
        token: ownerSession.token,
        tokenExpiration: ownerSession.tokenExpiration,
        refreshToken: ownerSession.refreshToken,
        refreshTokenExpiration: ownerSession.refreshTokenExpiration,
        userType: ownerSession.userType,
      });

      const verifiedUser = await refreshUserSession(ownerSession);
      if (!verifiedUser) {
        showToast({
          type: 'error',
          title: 'Sign Up',
          message: 'Account created, but we could not verify your session. Please log in.',
        });
        return;
      }

      showToast({
        type: 'success',
        title: 'Sign Up',
        message: 'Your account has been created successfully.',
      });

      router.replace(DEFAULT_ROUTES[verifiedUser.userType]);
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Sign Up',
        message:
          err instanceof ApolloError
            ? (err.graphQLErrors[0]?.message ?? err.message)
            : 'Failed to create your account. Please try again.',
      });
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="xlg:w-1/6 h-full sm:w-full md:w-3/6 lg:w-2/6">
        <Card className="w-full">
          <div className="flex flex-col gap-2">
            <div className="mb-2 flex flex-col p-2">
              <span className="text-2xl">Let&apos;s get started!</span>
              <span className="text-sm text-gray-400">
                First, let&apos;s create your ZeGo account
              </span>
            </div>

            <div>
              <Formik
                initialValues={account}
                validationSchema={SignupSchema}
                onSubmit={onSubmitHandler}
                validateOnChange={false}
              >
                {({ values, errors, handleChange }) => {
                  return (
                    <Form>
                      <div className="mb-2">
                        <CusomtTextField
                          type="text"
                          className="w-full"
                          placeholder="First Name"
                          name="firstName"
                          value={values.firstName}
                          onChange={handleChange}
                          maxLength={35}
                          showLabel={false}
                          style={{
                            borderColor: onErrorMessageMatcher(
                              'firstName',
                              errors?.firstName,
                              SignUpErrors
                            )
                              ? 'red'
                              : '',
                          }}
                        />
                      </div>

                      <div className="mb-2">
                        <CusomtTextField
                          type="text"
                          placeholder="Last Name"
                          name="lastName"
                          value={values.lastName}
                          onChange={handleChange}
                          maxLength={35}
                          showLabel={false}
                          style={{
                            borderColor: onErrorMessageMatcher(
                              'lastName',
                              errors?.lastName,
                              SignUpErrors
                            )
                              ? 'red'
                              : '',
                          }}
                        />
                      </div>

                      <div className="mb-2">
                        <CustomIconTextField
                          type="email"
                          name="email"
                          placeholder="Email"
                          maxLength={35}
                          iconProperties={{
                            icon: faEnvelope,
                            position: 'right',
                          }}
                          showLabel={false}
                          value={values.email}
                          onChange={handleChange}
                          style={{
                            borderColor: onErrorMessageMatcher(
                              'email',
                              errors?.email,
                              SignUpErrors
                            )
                              ? 'red'
                              : '',
                          }}
                        />
                      </div>

                      <div className="mb-2">
                        <CustomIconTextField
                          placeholder="Password"
                          name="password"
                          type="password"
                          maxLength={20}
                          value={values.password}
                          iconProperties={{
                            icon: faEye,
                            position: 'right',
                          }}
                          showLabel={false}
                          onChange={handleChange}
                          style={{
                            borderColor: onErrorMessageMatcher(
                              'password',
                              errors?.password,
                              SignUpErrors
                            )
                              ? 'red'
                              : '',
                          }}
                        />
                      </div>

                      <div className="mb-2">
                        <CustomIconTextField
                          placeholder="Confirm Password"
                          name="confirmPassword"
                          type="password"
                          maxLength={20}
                          iconProperties={{
                            icon: faEye,
                            position: 'right',
                          }}
                          showLabel={false}
                          value={values.confirmPassword}
                          onChange={handleChange}
                          style={{
                            borderColor: onErrorMessageMatcher(
                              'confirmPassword',
                              errors?.confirmPassword,
                              SignUpErrors
                            )
                              ? 'red'
                              : '',
                          }}
                        />
                      </div>

                      <div className="mb-2 flex flex-col gap-2 p-2">
                        <Divider align="left" className="m-0">
                          <div className="align-items-center inline-flex">
                            <i className="pi pi-lock mr-2"></i>
                            <b>Password Strength</b>
                          </div>
                        </Divider>

                        {PasswordErrors.map((pmessage, index) => {
                          return (
                            <div
                              key={index}
                              className={`${errors.password?.includes(pmessage) ? 'text-red-500' : 'text-gray-500'} text-sm`}
                            >
                              <i className="pi pi-times mr-2" />
                              <span>{pmessage}</span>
                            </div>
                          );
                        })}
                      </div>

                      <CustomButton
                        className="hover:bg-whit h-12 w-full border-gray-300 bg-transparent px-32 text-black dark:text-white"
                        label="Create Account"
                        rounded={true}
                        icon="pi pi-google"
                        type="submit"
                        loading={creating || loggingIn}
                      />
                    </Form>
                  );
                }}
              </Formik>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
