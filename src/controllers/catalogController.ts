import { Request, Response } from 'express';

export const getCatalogPlaceholder = (_req: Request, res: Response): void => {
  res.json({ message: 'catalog module placeholder' });
};
