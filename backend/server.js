require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { errorHandler } = require('./src/middleware/errorHandler');

const authRoutes = require('./src/routes/auth.routes');
const farmersRoutes = require('./src/routes/farmers.routes');
const cropsRoutes = require('./src/routes/crops.routes');
const centresRoutes = require('./src/routes/centres.routes');
const slotsRoutes = require('./src/routes/slots.routes');
const tokensRoutes = require('./src/routes/tokens.routes');
const queueRoutes = require('./src/routes/queue.routes');
const procurementRoutes = require('./src/routes/procurement.routes');
const paymentsRoutes = require('./src/routes/payments.routes');
const notificationsRoutes = require('./src/routes/notifications.routes');
const analyticsRoutes = require('./src/routes/analytics.routes');

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'cropflow-backend' }));

app.use('/api/auth', authRoutes);
app.use('/api/farmers', farmersRoutes);
app.use('/api/crops', cropsRoutes);
app.use('/api/centres', centresRoutes);
app.use('/api/slots', slotsRoutes);
app.use('/api/tokens', tokensRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/procurement', procurementRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/analytics', analyticsRoutes);

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`CropFlow backend listening on port ${PORT}`);
});

module.exports = app;
