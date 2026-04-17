import { createRequestConfig, type Locale } from '@roviq/i18n';

import { getLocaleMessages } from './messages';

export default createRequestConfig(async (locale) => getLocaleMessages(locale as Locale));
