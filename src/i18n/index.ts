import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ptCommon      from './locales/pt-BR/common.json';
import ptSettings    from './locales/pt-BR/settings.json';
import ptOnboarding  from './locales/pt-BR/onboarding.json';
import ptChat        from './locales/pt-BR/chat.json';
import ptClipboard   from './locales/pt-BR/clipboard.json';
import ptAccount     from './locales/pt-BR/account.json';
import ptThemes      from './locales/pt-BR/themes.json';
import ptErrors      from './locales/pt-BR/errors.json';
import ptLoading     from './locales/pt-BR/loading.json';
import ptEmpty       from './locales/pt-BR/empty.json';
import ptToasts      from './locales/pt-BR/toasts.json';
import ptStealth     from './locales/pt-BR/stealth.json';
import ptCtas        from './locales/pt-BR/ctas.json';

import enCommon      from './locales/en-US/common.json';
import enSettings    from './locales/en-US/settings.json';
import enOnboarding  from './locales/en-US/onboarding.json';
import enChat        from './locales/en-US/chat.json';
import enClipboard   from './locales/en-US/clipboard.json';
import enAccount     from './locales/en-US/account.json';
import enThemes      from './locales/en-US/themes.json';
import enErrors      from './locales/en-US/errors.json';
import enLoading     from './locales/en-US/loading.json';
import enEmpty       from './locales/en-US/empty.json';
import enToasts      from './locales/en-US/toasts.json';
import enStealth     from './locales/en-US/stealth.json';
import enCtas        from './locales/en-US/ctas.json';

import esCommon      from './locales/es-ES/common.json';
import esSettings    from './locales/es-ES/settings.json';
import esOnboarding  from './locales/es-ES/onboarding.json';
import esChat        from './locales/es-ES/chat.json';
import esClipboard   from './locales/es-ES/clipboard.json';
import esAccount     from './locales/es-ES/account.json';
import esThemes      from './locales/es-ES/themes.json';
import esErrors      from './locales/es-ES/errors.json';
// es-ES stubs (MC5): loading/empty/toasts/stealth/ctas herdam en-US; tradução real em v1.1+.
import esLoading     from './locales/es-ES/loading.json';
import esEmpty       from './locales/es-ES/empty.json';
import esToasts      from './locales/es-ES/toasts.json';
import esStealth     from './locales/es-ES/stealth.json';
import esCtas        from './locales/es-ES/ctas.json';

import { detectInitialLanguage } from './defaults';

// i18n sync boot — idioma real é definido pelo settingsStore assim que
// carrega (que chama i18n.changeLanguage). Enquanto o store não carregou,
// rodamos com a heurística do navigator pra evitar flash de PT em UI EN.
i18n
  .use(initReactI18next)
  .init({
    resources: {
      'pt-BR': {
        common: ptCommon,
        settings: ptSettings,
        onboarding: ptOnboarding,
        chat: ptChat,
        clipboard: ptClipboard,
        account: ptAccount,
        themes: ptThemes,
        errors: ptErrors,
        loading: ptLoading,
        empty: ptEmpty,
        toasts: ptToasts,
        stealth: ptStealth,
        ctas: ptCtas,
      },
      'en-US': {
        common: enCommon,
        settings: enSettings,
        onboarding: enOnboarding,
        chat: enChat,
        clipboard: enClipboard,
        account: enAccount,
        themes: enThemes,
        errors: enErrors,
        loading: enLoading,
        empty: enEmpty,
        toasts: enToasts,
        stealth: enStealth,
        ctas: enCtas,
      },
      'es-ES': {
        common: esCommon,
        settings: esSettings,
        onboarding: esOnboarding,
        chat: esChat,
        clipboard: esClipboard,
        account: esAccount,
        themes: esThemes,
        errors: esErrors,
        loading: esLoading,
        empty: esEmpty,
        toasts: esToasts,
        stealth: esStealth,
        ctas: esCtas,
      },
    },
    lng: detectInitialLanguage(),
    fallbackLng: 'en-US',
    defaultNS: 'common',
    ns: ['common', 'settings', 'onboarding', 'chat', 'clipboard', 'account', 'themes', 'errors', 'loading', 'empty', 'toasts', 'stealth', 'ctas'],
    interpolation: { escapeValue: false },  // React já escapa
    returnNull: false,
    react: { useSuspense: false },
  });

export default i18n;
