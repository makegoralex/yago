import { randomBytes } from 'crypto';

const token = randomBytes(32).toString('hex');

console.log(`PRINT_JOB_TOKEN=${token}`);
