const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

const prisma = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const consultationRoutes = require('./routes/consultationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const { initCronJobs } = require('./jobs/cronScheduler');
const { seedDatabase } = require('./utils/seed');

const app = express();
const PORT = process.env.PORT || 5050;

// Middleware
app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Healthcare Appointment & Follow-up Manager API',
    uptime: process.uptime(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

// Serve Client Build in Production / Standalone mode
const candidatePaths = [
  path.join(__dirname, '../../client/dist'),
  path.join(process.cwd(), 'client/dist'),
  path.join(process.cwd(), '../client/dist'),
  path.join(__dirname, '../client/dist'),
];
const clientDistPath = candidatePaths.find((p) => fs.existsSync(p));

if (clientDistPath) {
  console.log(`[Server] 🌐 Serving client SPA from: ${clientDistPath}`);
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[UnhandledError]', err.stack);
  res.status(500).json({
    error: err.message || 'Internal Server Error',
  });
});

// Auto-seed database if empty on startup
const autoSeedIfEmpty = async () => {
  try {
    const doctorCount = await prisma.doctorProfile.count();
    if (doctorCount === 0) {
      console.log('[Server] 📦 Empty database detected. Auto-seeding clinical records...');
      await seedDatabase();
    }
  } catch (err) {
    console.warn('[Server] Auto-seed check notice:', err.message);
  }
};

// Start Server & Background Cron Jobs
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 NexusCare Server running on port ${PORT}`);
  await autoSeedIfEmpty();
  initCronJobs();
});
