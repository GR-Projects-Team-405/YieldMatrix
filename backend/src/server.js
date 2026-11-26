import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import authRoutes from './modules/auth/demoAuthRoutes.js';
import ym01Routes from './modules/ym01/routes.js';
import ym02Routes from './modules/ym02/routes.js';
import ym03Routes from './modules/ym03/routes.js';
import ym04Routes from './modules/ym04/routes.js';
import ym05Routes from './modules/ym05/routes.js';
import ym06Routes from './modules/ym06/routes.js';
import ym07Routes from './modules/ym07/routes.js';
import ym08Routes from './modules/ym08/routes.js';
import ym09Routes from './modules/ym09/routes.js';
import ym10Routes from './modules/ym10/routes.js';
import ym11Routes from './modules/ym11/routes.js';
import ym12Routes from './modules/ym12/routes.js';
import ym13Routes from './modules/ym13/routes.js';
import ym14Routes from './modules/ym14/routes.js';
import ym15Routes from './modules/ym15/routes.js';
import ym16Routes from './modules/ym16/routes.js';
import ym17Routes from './modules/ym17/routes.js';
import ym18Routes from './modules/ym18/routes.js';
import ym19Routes from './modules/ym19/routes.js';
import ym20Routes from './modules/ym20/routes.js';
import ym21Routes from './modules/ym21/routes.js';
import ym22Routes from './modules/ym22/routes.js';
import ym23Routes from './modules/ym23/routes.js';
import ym24Routes from './modules/ym24/routes.js';
import ym25Routes from './modules/ym25/routes.js';
import ym26Routes from './modules/ym26/routes.js';
import ym27Routes from './modules/ym27/routes.js';
import ym28Routes from './modules/ym28/routes.js';
import ym29Routes from './modules/ym29/routes.js';
import ym30Routes from './modules/ym30/routes.js';
import ym31Routes from './modules/ym31/routes.js';
import ym32Routes from './modules/ym32/routes.js';

export const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => { req.requestId = randomUUID(); res.setHeader('X-Request-ID', req.requestId); next(); });
app.use(cors({
  origin: (origin, callback) => {
    const allowed = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [process.env.FRONTEND_URL || 'http://localhost:5173'];
    if (!origin || allowed.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '64kb' }));
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'yieldmatrix-api', requestId: req.requestId }));
app.get('/health', (req, res) => res.json({ status: 'ok', message: 'YieldMatrix API is running', requestId: req.requestId }));
app.use('/api/auth', authRoutes);

// YM01 - Aathil Hakam: Public pages. Add routes inside modules/ym01/routes.js.
app.use('/api/ym01', ym01Routes);

// YM02 - Ashen Ranasingha: Login & account access. Add routes inside modules/ym02/routes.js.
app.use('/api/ym02', ym02Routes);

// YM03 - Chamalsha Induwara: Sign up & Login. Add routes inside modules/ym03/routes.js.
app.use('/api/ym03', ym03Routes);

// YM04 - Chamasha Saminidi Stuwart: Reference data & audit. Add routes inside modules/ym04/routes.js.
app.use('/api/ym04', ym04Routes);

// YM05 - Chamidu Pethum: Notifications. Add routes inside modules/ym05/routes.js.
app.use('/api/ym05', ym05Routes);

// YM06 - Eshan Harshana: Farmer overview. Add routes inside modules/ym06/routes.js.
app.use('/api/ym06', ym06Routes);

// YM07 - Hathiff Haleem: Farm management. Add routes inside modules/ym07/routes.js.
app.use('/api/ym07', ym07Routes);

// YM08 - Imalka Deshan: Harvest management. Add routes inside modules/ym08/routes.js.
app.use('/api/ym08', ym08Routes);

// YM09 - Imalka Randev: Produce listings. Add routes inside modules/ym09/routes.js.
app.use('/api/ym09', ym09Routes);

// YM10 - Kasuni Madeesha: Farmer offers. Add routes inside modules/ym10/routes.js.
app.use('/api/ym10', ym10Routes);

// YM11 - Meranga Akash: Buyer marketplace. Add routes inside modules/ym11/routes.js.
app.use('/api/ym11', ym11Routes);

// YM12 - MHD Muhthas: Produce & suppliers. Add routes inside modules/ym12/routes.js.
app.use('/api/ym12', ym12Routes);

// YM13 - Migara Wijesinghe: Buyer demands. Add routes inside modules/ym13/routes.js.
app.use('/api/ym13', ym13Routes);

// YM14 - Mohomad Mushrif: Offers & commitments. Add routes inside modules/ym14/routes.js.
app.use('/api/ym14', ym14Routes);

// YM15 - Nadisha Buddhini: Bulk matching. Add routes inside modules/ym15/routes.js.
app.use('/api/ym15', ym15Routes);

// YM16 - Nadula Hatharasingha: Reservations. Add routes inside modules/ym16/routes.js.
app.use('/api/ym16', ym16Routes);

// YM17 - Nimesh De Alwis: Farmer allocations. Add routes inside modules/ym17/routes.js.
app.use('/api/ym17', ym17Routes);

// YM18 - Nipuni Thakshila: Buyer orders. Add routes inside modules/ym18/routes.js.
app.use('/api/ym18', ym18Routes);

// YM19 - Pasan Kalhara: Acceptance & disputes. Add routes inside modules/ym19/routes.js.
app.use('/api/ym19', ym19Routes);

// YM20 - Praveena Buddini: Order & transaction records. Add routes inside modules/ym20/routes.js.
app.use('/api/ym20', ym20Routes);

// YM21 - Rashmika Ravihara: Driver overview & vehicle. Add routes inside modules/ym21/routes.js.
app.use('/api/ym21', ym21Routes);

// YM22 - Rukshan Senevirathna: Trips & routes. Add routes inside modules/ym22/routes.js.
app.use('/api/ym22', ym22Routes);

// YM23 - Sandeepa Subashini: Pickup management. Add routes inside modules/ym23/routes.js.
app.use('/api/ym23', ym23Routes);

// YM24 - Sasindu Lakshan: Delivery & incidents. Add routes inside modules/ym24/routes.js.
app.use('/api/ym24', ym24Routes);

// YM25 - Shathir Sheriff: Traceability. Add routes inside modules/ym25/routes.js.
app.use('/api/ym25', ym25Routes);

// YM26 - Shermi Weerasinghe: Admin operations. Add routes inside modules/ym26/routes.js.
app.use('/api/ym26', ym26Routes);

// YM27 - Udith Rashan: Farmer wallet. Add routes inside modules/ym27/routes.js.
app.use('/api/ym27', ym27Routes);

// YM28 - Umindu Isith: Buyer wallet & reconciliation. Add routes inside modules/ym28/routes.js.
app.use('/api/ym28', ym28Routes);

// YM29 - Yasindu Janapriya: Market information. Add routes inside modules/ym29/routes.js.
app.use('/api/ym29', ym29Routes);

// YM30 - Yugen Suresh: People & access. Add routes inside modules/ym30/routes.js.
app.use('/api/ym30', ym30Routes);

// YM31 - Ashen Lakmal: Help. Add routes inside modules/ym31/routes.js.
app.use('/api/ym31', ym31Routes);

// YM32 - Sewmini Wijesiri: Profile. Add routes inside modules/ym32/routes.js.
app.use('/api/ym32', ym32Routes);

app.use((req, res) => res.status(404).json({ error: 'Route not found', requestId: req.requestId }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.type === 'entity.parse.failed' ? 400 : error.type === 'entity.too.large' ? 413 : 500;
  res.status(status).json({ error: status === 400 ? 'Invalid JSON' : status === 413 ? 'Request too large' : 'Request could not be completed', requestId: req.requestId });
});
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.JWT_SECRET) throw new Error('Set JWT_SECRET in backend/.env before starting');
  const port = process.env.PORT || 5000;
  app.get('/health', (req, res) => res.json({ status: 'ok', message: 'YieldMatrix API is running', requestId: req.requestId }));
  app.listen(port, '127.0.0.1', () => console.log(`YieldMatrix API: http://localhost:${port}`));
}
