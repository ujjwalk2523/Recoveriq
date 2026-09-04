import { ApiKeyEnvironment } from '@prisma/client';
import { ApiScope } from '../scopes';

export interface ApiRequestContext {
  apiKeyId: string;
  merchantId: string;
  environment: ApiKeyEnvironment;
  scopes: ApiScope[];
  name: string;
  requestId: string;
}
