import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { authMiddleware, requireRole } from '../middleware/auth';

const contentRouter = Router();

const contentFilePath = path.resolve(process.cwd(), 'data', 'content.json');

const readContentFile = async () => {
  try {
    const raw = await fs.readFile(contentFilePath, 'utf-8');
    return JSON.parse(raw);
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
};

const writeContentFile = async (payload: unknown) => {
  await fs.mkdir(path.dirname(contentFilePath), { recursive: true });
  await fs.writeFile(contentFilePath, JSON.stringify(payload, null, 2), 'utf-8');
};

contentRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const payload = await readContentFile();
    res.json({ data: payload });
  } catch (error) {
    console.error('Failed to read content file:', error);
    res.status(500).json({ data: null, error: 'Failed to read content' });
  }
});

contentRouter.put('/', authMiddleware, requireRole('superAdmin'), async (req: Request, res: Response) => {
  try {
    await writeContentFile(req.body ?? {});
    res.json({ data: true });
  } catch (error) {
    console.error('Failed to write content file:', error);
    res.status(500).json({ data: null, error: 'Failed to save content' });
  }
});

export default contentRouter;
