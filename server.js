require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 5000;

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  _id: String,
  username: String,
  password: String,
  email: String,
  device: String,
  name: String,
  phone: String,
  address: String
});
const User = mongoose.model('User', userSchema, 'users');

// Dog Schema
const dogSchema = new mongoose.Schema({
  _id: String,
  nfcTagId: String,
  name: String,
  description: String,
  age: String,
  weight: String,
  coat: String,
  sex: String,
  eyeColor: String,
  neutered: String,
  breed: String,
  personality: String,
  loves: String,
  routine: String,
  training: String,
  quirks: String,
  medicalInfo: Object,
  socials: Object,
  testimonials: Array,
  gallery: Array,
  photoUrl: String,
  ownerId: String
});
const Dog = mongoose.model('Dog', dogSchema, 'dogs');

// Location Schema
const locationSchema = new mongoose.Schema({
  _id: String,
  dogId: String,
  deviceName: String,
  latitude: Number,
  longitude: Number,
  timestamp: Date,
  active: Boolean
});
const Location = mongoose.model('Location', locationSchema, 'locations');

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// API Endpoints
app.get('/api/user-data', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const dog = await Dog.findOne({ ownerId: req.user._id });
    res.json({ user, dog });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

app.get('/api/dog/:tagId', async (req, res) => {
  try {
    const dog = await Dog.findOne({ nfcTagId: req.params.tagId });
    if (!dog) return res.status(404).json({ error: 'Dog not found' });
    res.json(dog);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dog data' });
  }
});

app.get('/api/locations/:tagId', async (req, res) => {
  try {
    const dog = await Dog.findOne({ nfcTagId: req.params.tagId });
    if (!dog) return res.status(404).json({ error: 'Dog not found' });
    const locations = await Location.find({ dogId: dog._id });
    res.json(locations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

app.post('/api/report-lost', async (req, res) => {
  try {
    const { dogId, finderName, finderContact, location } = req.body;
    // Implementation pending: Store report in a new collection or notify owner
    res.status(200).json({ message: 'Report submitted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.cookie('token', token, { httpOnly: true, secure: true }).json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { email, password, name, phone, address, device } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      _id: new mongoose.Types.ObjectId().toString(),
      username: email.split('@')[0],
      password: hashedPassword,
      email,
      device,
      name,
      phone,
      address
    });
    await user.save();
    res.status(201).json({ message: 'Registration successful' });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/logout', authenticateToken, (req, res) => {
  res.clearCookie('token').json({ message: 'Logged out successfully' });
});

app.post('/api/reset-password', async (req, res) => {
  try {
    const { email } = req.body;
    // Implementation pending: Send reset link via email
    res.status(200).json({ message: 'Password reset link sent' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send reset link' });
  }
});

app.put('/api/dog/:id', authenticateToken, async (req, res) => {
  try {
    const dog = await Dog.findById(req.params.id);
    if (!dog || dog.ownerId !== req.user._id) return res.status(403).json({ error: 'Unauthorized' });
    const updatedDog = await Dog.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedDog);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update dog data' });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
