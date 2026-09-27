import React, { useContext } from 'react'
import { View, SafeAreaView, Alert } from 'react-native'
import { useQuery } from '@apollo/client'
import gql from 'graphql-tag'
import { useTranslation } from 'react-i18next'
import TextDefault from '../../components/Text/TextDefault/TextDefault'
import ThemeContext from '../../ui/ThemeContext/ThemeContext'
import { theme } from '../../utils/themeColors'
import UserContext from '../../context/User'
import ConfigurationContext from '../../context/Configuration'
import Spinner from '../../components/Spinner/Spinner'
import ButtonContainer from '../../components/Profile/ButtonContainer/ButtonContainer'
import { Divider, SectionHeader, useMultivendorTheme } from '../../ui/designSystem'

const PROFILE_WALLET = gql`
  query ProfileWallet {
    profile {
      _id
      walletBalance
    }
  }
`

function Wallet() {
  const { t } = useTranslation()
  const themeContext = useContext(ThemeContext)
  const currentTheme = theme[themeContext.ThemeValue]
  const { tokens } = useMultivendorTheme()
  const { isLoggedIn } = useContext(UserContext)
  const configuration = useContext(ConfigurationContext)
  const currencySymbol = configuration?.currencySymbol || '$'

  const { data, loading } = useQuery(PROFILE_WALLET, {
    fetchPolicy: 'network-only',
    skip: !isLoggedIn
  })

  const balance = data?.profile?.walletBalance ?? 0

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: currentTheme.themeBackground }}>
      <View style={{ padding: tokens.spacing.lg }}>
        <SectionHeader title={t('Wallet')} />

        <View
          style={{
            backgroundColor: tokens.colors.surfaceElevated ?? currentTheme.cardBackground,
            borderRadius: 16,
            padding: tokens.spacing.lg,
            marginTop: tokens.spacing.md
          }}
        >
          <TextDefault textColor={tokens.colors.textSecondary} small>
            {t('Balance')}
          </TextDefault>
          {loading ? (
            <Spinner size='small' backColor={currentTheme.themeBackground} spinnerColor={currentTheme.main} />
          ) : (
            <TextDefault bolder H2 textColor={tokens.colors.textPrimary} style={{ marginTop: 4 }}>
              {currencySymbol}
              {Number(balance).toFixed(2)}
            </TextDefault>
          )}
        </View>

        <Divider insetStart={0} insetEnd={0} />

        <ButtonContainer
          icon={'add-circle-outline'}
          iconType={'Ionicons'}
          onPress={() =>
            Alert.alert(t('Wallet'), t('WalletTopUpComingSoon') || 'Fonctionnalité bientôt disponible')
          }
          title={t('AddFunds') || 'Recharger'}
          currentTheme={currentTheme}
        />
      </View>
    </SafeAreaView>
  )
}

export default Wallet
