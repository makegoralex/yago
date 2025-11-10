import { Router } from 'express';

import { getCatalogPlaceholder } from '../controllers/catalogController';

export const catalogRouter = Router();

catalogRouter.get('/', getCatalogPlaceholder);
