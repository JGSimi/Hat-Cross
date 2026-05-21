import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import ptCommon      from './locales/pt-BR/common.json';
import ptSettings    from './locales/pt-BR/settings.json';
import ptClipboard   from './locales/pt-BR/clipboard.json';
import ptAccount     from './locales/pt-BR/account.json';
import ptThemes      from './locales/pt-BR/themes.json';
import ptErrors      from './locales/pt-BR/errors.json';
import ptLoading     from './locales/pt-BR/loading.json';
import ptToasts      from './locales/pt-BR/toasts.json';
import ptRooms       from './locales/pt-BR/rooms.json';

import enCommon      from './locales/en-US/common.json';
import enSettings    from './locales/en-US/settings.json';
import enClipboard   from './locales/en-US/clipboard.json';
import enAccount     from './locales/en-US/account.json';
import enThemes      from './locales/en-US/themes.json';
import enErrors      from './locales/en-US/errors.json';
import enLoading     from './locales/en-US/loading.json';
import enToasts      from './locales/en-US/toasts.json';
import enRooms       from './locales/en-US/rooms.json';

import esCommon      from './locales/es-ES/common.json';
import esSettings    from './locales/es-ES/settings.json';
import esClipboard   from './locales/es-ES/clipboard.json';
import esAccount     from './locales/es-ES/account.json';
import esThemes      from './locales/es-ES/themes.json';
import esErrors      from './locales/es-ES/errors.json';
import esLoading     from './locales/es-ES/loading.json';
import esToasts      from './locales/es-ES/toasts.json';
import esRooms       from './locales/es-ES/rooms.json';

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
        clipboard: ptClipboard,
        account: ptAccount,
        themes: ptThemes,
        errors: ptErrors,
        loading: ptLoading,
        toasts: ptToasts,
        rooms: ptRooms,
      },
      'en-US': {
        common: enCommon,
        settings: enSettings,
        clipboard: enClipboard,
        account: enAccount,
        themes: enThemes,
        errors: enErrors,
        loading: enLoading,
        toasts: enToasts,
        rooms: enRooms,
      },
      'es-ES': {
        common: esCommon,
        settings: esSettings,
        clipboard: esClipboard,
        account: esAccount,
        themes: esThemes,
        errors: esErrors,
        loading: esLoading,
        toasts: esToasts,
        rooms: esRooms,
      },
    },
    lng: detectInitialLanguage(),
    fallbackLng: 'en-US',
    defaultNS: 'common',
    ns: ['common', 'settings', 'clipboard', 'account', 'themes', 'errors', 'loading', 'toasts', 'rooms'],
    interpolation: { escapeValue: false },  // React já escapa
    returnNull: false,
    react: { useSuspense: false },
  });

export default i18n;
