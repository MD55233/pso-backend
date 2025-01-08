const express = require('express');
const multer = require('multer');
const path = require('path');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 8001;

// SMTP Configuration for Hostinger Webmail
const transporter = nodemailer.createTransport({
  host: "smtp.hostinger.com",
  port: 465,
  secure: true,
  auth: {
      user: 'process.env.SMTP_EMAIL',
      pass: 'process.env.SMTP_PASSWORD',
  },
 auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
},

});

// Generate Random Username and Password
const generateCredentials = () => {
  const username = `user${Math.floor(1000 + Math.random() * 9000)}`;
  const password = Math.random().toString(36).slice(-8);
  return { username, password };
};

// ------------||Serve static files from the 'uploads' directory||----------------------
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

console.log('Attempting to start server on port:', PORT);

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Your middleware and routes go here

app.listen(PORT, (err) => {
  if (err) {
    console.error('Error starting server:', err);
  } else {
    console.log(`Server is running on port ${PORT}`);
  }
});

// Close the Mongoose connection if the Node process ends
process.on('SIGINT', () => {
  mongoose.connection.close(() => {
    console.log('Mongoose connection disconnected through app termination');
    process.exit(0);
  });
});
app.use(bodyParser.json());
app.use(cors());

// User Model
const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true, trim: true },
    phoneNumber: { type: String, required: true },
    accountType: { type: String, required: true,  default: 'Starter' }, // e.g., "Starter", "Pro", "Premium"
    balance: { type: Number, default: 0 },
    withdrawalBalance: { type: Number, default: 0 },
    dailyTaskLimit: { type: Number, required: true , default: 10 },
    lastCompletedDate: { type: Date, default: null },
    tasksCompletedToday: { type: Number, default: 0 },
    bonusBalance: { type: Number, default: 0 },
    referralDetails: {
      referralCode: { type: String },
      referrer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },
    taskHistory: [
      {
        taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
        completedAt: { type: Date },
        reward: { type: Number },
      },
    ],
    transactionHistory: [
      {
        type: { type: String, required: true }, // "credit" or "debit"
        amount: { type: Number, required: true },
        description: { type: String, trim: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    commissionPendingTasks: [
      {
        taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
        commissionAmount: { type: Number, required: true },
        releaseDate: { type: Date, required: true },
      },
    ],
    planActivationDate: { type: Date, default: null },
    profilePicture: { type: String, default: null },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    pendingCommission: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);  // Define User model

// Admin Schema
const adminSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  totalProfit: { type: Number, default: 0 },
  monthlyProfit: { type: Number, default: 0 },
  transactions: [{
    amount: { type: Number, required: true },
    type: { type: String, required: true }, // e.g., "Withdrawal", "Deposit"
    date: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

const Admin = mongoose.model('Admin', adminSchema);
// Route to fetch transaction history for a specific user
app.get('/api/transaction-history/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const transactions = user.transactionHistory.map((transaction) => ({
      ...transaction.toObject(),
      _id: transaction._id,
      type: transaction.type || '-',
      amount: transaction.amount || 0,
      status: 'completed', // Default status, you can adjust based on your schema
      accountNumber: '-', // Placeholder
      gateway: '-', // Placeholder
      remarks: transaction.description || '-',
      createdAt: transaction.createdAt,
    }));

    // Sort transactions by date in descending order
    transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});
app.post('/api/signup', async (req, res) => {
  const { fullName, email, phoneNumber, referrerPin } = req.body;

  try {
    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already exists. Please use a different email.' });
    }

    // Check if the referrerPin matches an existing username
    let referrer = null;
    if (referrerPin) {
      referrer = await User.findOne({ username: referrerPin });
      if (!referrer) {
        return res.status(400).json({ success: false, message: 'Invalid referral code (referrerPin). Please check and try again.' });
      }
    }

    const { username, password } = generateCredentials();

    const newUser = new User({
      fullName,
      username,
      email,
      phoneNumber,
      password,
      referralDetails: {
        referralCode: referrer ? referrer.username : null, // Set referralCode to referrer’s username
        referrer: referrer ? referrer._id : null, // Store referrer’s ObjectId for reference
      },
    });

    await newUser.save();

    // Send Email
    await transporter.sendMail({
      from: `LaikoStar.Team <${process.env.SMTP_EMAIL}>`,
      to: email,
      subject: 'Welcome to Our Platform!',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #4CAF50; text-align: center;">Welcome to Our Platform,</h2>
            <h2 style="color: #4CAF50; text-align: center;"> ${fullName}!</h2>
          <p>We are thrilled to have you on board. Your account has been successfully created, and here are your details:</p>
          <div style="border: 1px solid #ddd; padding: 15px; border-radius: 5px; background: #f9f9f9;">
            <p><strong>Username:</strong> ${username}</p>
            <p><strong>Password:</strong> ${password}</p>
            <p><strong>Referral Code:</strong> ${referrer ? referrer.username : 'None'}</p>
          </div>
          <p>Please keep these details safe and secure. You can use them to log in to your account anytime.</p>
          <h3 style="color: #4CAF50;">Get Started</h3>
          <p>Click the button below to log in to your account:</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="https://account.laikostar.com/pages/login/login3" 
               style="text-decoration: none; padding: 10px 20px; color: white; background-color: #4CAF50; border-radius: 5px; font-weight: bold;">Log In to Your Account</a>
          </div>
          <p>If you have any questions, feel free to reach out to our support team.</p>
          <p>Thank you for choosing us!</p>
          <p style="margin-top: 20px;">Warm regards,<br><strong>The Team at Our Platform</strong></p>
        </div>
      `,
    });
    
    res.json({ success: true });
  } catch (err) {
    if (err.code === 11000) {
      // Duplicate key error (e.g., email or username already exists)
      return res.status(400).json({ success: false, message: 'Email or username already exists. Please use a different one.' });
    }
    console.error(err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});
// Route to fetch all data of a user based on username
app.get('/api/user/:username', async (req, res) => {
  const { username } = req.params;

  try {
    // Find the user by username and populate related fields
    const user = await User.findOne({ username })
      .populate('taskHistory.taskId') // Populate task details
      .populate('commissionPendingTasks.taskId') // Populate commission pending tasks
      .exec();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prepare the response with all relevant user data
    const userData = {
      _id: user._id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      phoneNumber: user.phoneNumber,
      accountType: user.accountType,
      balance: user.balance,
      withdrawalBalance: user.withdrawalBalance,
      dailyTaskLimit: user.dailyTaskLimit,
      tasksCompletedToday: user.tasksCompletedToday,
      bonusBalance: user.bonusBalance,
      referralDetails: user.referralDetails,
      taskHistory: user.taskHistory,
      transactionHistory: user.transactionHistory,
      commissionPendingTasks: user.commissionPendingTasks,
      planActivationDate: user.planActivationDate,
      profilePicture: user.profilePicture,
      parent: user.parent,
      pendingCommission: user.pendingCommission,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // Return the complete user data
    res.status(200).json({ user: userData });

  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});
// Configure Multer for file uploads
const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, '../uploads/tasks');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const uploadFile = multer({ storage: fileStorage });

// Task Schema
const taskSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    reward: { type: Number, required: true },
    image: { type: String }, // URL to the task image
    completedCount: { type: Number, default: 0 }, 
    redirectLink: { type: String, required: true }, // New field for redirection link
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const TaskModel = mongoose.model('Task', taskSchema);

// TaskTransaction Schema with username
const taskTransactionSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task',
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    description: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    transactionType: {
      type: String,
      enum: ['credit', 'debit'],
      required: true
    }
  },
  { timestamps: true }
);
const TaskTransaction = mongoose.model('TaskTransaction', taskTransactionSchema);
// Routes
// Fetch all tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await TaskModel.find();
    res.status(200).json({ tasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
  
});


app.post('/api/tasks/:taskId/complete', async (req, res) => {
  const { taskId } = req.params;
  const { username } = req.body;

  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'Invalid username' });
  }

  try {
    const user = await User.findOne({ username: username });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const today = new Date().toISOString().split('T')[0];
    const lastCompletedDate = user.lastCompletedDate
      ? user.lastCompletedDate.toISOString().split('T')[0]
      : null;

    if (lastCompletedDate !== today) {
      user.tasksCompletedToday = 0;
      user.lastCompletedDate = new Date();
    }

    if (user.tasksCompletedToday >= user.dailyTaskLimit) {
      return res.status(400).json({ error: 'Daily task limit reached. Please try again tomorrow.' });
    }

    const task = await TaskModel.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    user.tasksCompletedToday += 1;
    user.pendingCommission += task.reward;
    task.completedCount = (task.completedCount || 0) + 1;

    const transaction = new TaskTransaction({
      username: username,
      taskId: task._id,
      amount: task.reward,
      status: 'pending',
      description: `Completed task: ${task.name}`,
      transactionType: 'credit',
    });

    await transaction.save();
    await task.save();
    await user.save();

    res.status(200).json({
      message: 'Task completed successfully',
      redirectLink: task.redirectLink,
    });
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

// Create a new task with an image upload
app.post('/api/tasks', uploadFile.single('image'), async (req, res) => {
  const { name, description, reward } = req.body;
  const image = req.file ? req.file.path : null;

  try {
    const newTask = new TaskModel({ name, description, reward, image });
    await newTask.save();
    res.status(201).json({ message: 'Task created successfully', task: newTask });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

// Fetch Task Transactions for a specific user
app.get('/api/task-transactions/:username', async (req, res) => {
  const { username } = req.params;

  try {
    // Find all task transactions for the given username
    const taskTransactions = await TaskTransaction.find({ username })
      .populate('taskId', 'name')  // Populate task name from Task model
      .sort({ createdAt: -1 }); // Sort by most recent transaction

    if (!taskTransactions) {
      return res.status(404).json({ message: 'No transactions found for this user.' });
    }

    res.status(200).json(taskTransactions);
  } catch (error) {
    console.error('Error fetching task transactions:', error);
    res.status(500).json({ message: 'Internal server error while fetching task transactions.' });
  }
});

// ]----------------------||Authentication Endpoint||--------------------------------[

app.post('/api/authenticate', async (req, res) => {
  const { usernameOrEmail, password } = req.body;

  try {
    const user = await User.findOne({
      $or: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
      password: password
    });

    if (user) {
      res.json({ success: true, username: user.username });
    } else {
      res.json({ success: false });
    }
  } catch (error) {
    console.error('Error during authentication:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});
//------------------------||Training Bonus Approval Queue||--------------------------

const TrainingBonusApprovalSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    transactionId: { type: String, required: true },
    transactionAmount: { type: Number, required: true },
    gateway: { type: String, required: true },
    imagePath: { type: String, required: true },
    status: { type: String, default: 'pending' }
  },
  {
    timestamps: true // Automatically adds createdAt and updatedAt timestamps
  }
);

const TrainingBonusApproval = mongoose.model('TrainingBonusApproval', TrainingBonusApprovalSchema);

// Define approved schema
const TrainingBonusApprovedSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    transactionId: { type: String, required: true },
    transactionAmount: { type: Number, required: true },
    gateway: { type: String, required: true },
    addedPoints: { type: Number, required: true },
    imagePath: { type: String, required: true },
    status: { type: String, default: 'approved' }
  },
  {
    timestamps: true // Automatically adds createdAt and updatedAt timestamps
  }
);

const TrainingBonusApproved = mongoose.model('TrainingBonusApproved', TrainingBonusApprovedSchema);

// Define rejected schema
const TrainingBonusRejectedSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    transactionId: { type: String, required: true },
    transactionAmount: { type: Number, required: true },
    gateway: { type: String, required: true },
    imagePath: { type: String, required: true },
    feedback: { type: String, required: true },
    status: { type: String, default: 'rejected' }
  },
  {
    timestamps: true // Automatically adds createdAt and updatedAt timestamps
  }
);

const TrainingBonusRejected = mongoose.model('TrainingBonusRejected', TrainingBonusRejectedSchema);

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, '../uploads/training-bonus'); // Uploads folder where files will be stored
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + Date.now() + ext);
  }
});

// Multer file filter
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Multer upload instance
const upload = multer({ storage: storage, fileFilter: fileFilter });

app.use(express.json());

// -----------||POST route for uploading training bonus data||---------------

app.post('/api/training-bonus/upload', upload.single('image'), async (req, res) => {
  try {
    const { username, transactionId, transactionAmount, gateway } = req.body;

    // Construct the file path for the uploaded image
    const imagePath = req.file.path;

    // Create new TrainingBonusApproval document
    const newApproval = new TrainingBonusApproval({
      username,
      transactionId,
      transactionAmount: Number(transactionAmount),
      gateway,
      imagePath: imagePath
    });

    // Save the new document to MongoDB
    await newApproval.save();

    res.status(201).json({ message: 'Training bonus approval data uploaded successfully.' });
  } catch (err) {
    console.error('Error uploading training bonus data:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Fetch training bonuses for the user
app.get('/api/training-bonus/:username', async (req, res) => {
  try {
    const bonuses = await TrainingBonusApproval.find({ username: req.params.username }).sort({ createdAt: -1 });
    res.json(bonuses);
  } catch (error) {
    console.error('Error fetching training bonuses:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Fetch approved training bonuses for the user
app.get('/api/approvals/approve/:username', async (req, res) => {
  try {
    const approvedBonuses = await TrainingBonusApproved.find({ username: req.params.username }).sort({ createdAt: -1 });
    res.json(approvedBonuses);
  } catch (error) {
    console.error('Error fetching approved training bonuses:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Fetch rejected training bonuses for the user
app.get('/api/approvals/reject/:username', async (req, res) => {
  try {
    const rejectedBonuses = await TrainingBonusRejected.find({ username: req.params.username }).sort({ createdAt: -1 });
    res.json(rejectedBonuses);
  } catch (error) {
    console.error('Error fetching rejected training bonuses:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

//       ]------------------------||Investment Plans Model||----------------------------[

const planSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  DailyTaskLimit:{ type: Number, required: true },
  DirectBonus: { type: Number, required: true },
  IndirectBonus: { type: Number, required: true },
 
});
const Plan = mongoose.model('Plan', planSchema);

//      ]---------------------GET all Plans Documents-----------------------[

app.get('/api/plans', async (req, res) => {
  try {
    const plans = await Plan.find();
    res.json(plans);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
// ]-------------------||Get Profile Data by username from User Model||-------------------------[

app.get('/api/users/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({
      fullName: user.fullName,
      rank: user.rank,
      plan: user.plan,
      refPer: user.refPer,
      phone: user.phoneNumber,
      refParentPer: user.refParentPer
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});
// Referral Payment Verification Schema (updated for consistency)
const referralPaymentSchema = new mongoose.Schema({
  username: { type: String, required: true },
  transactionId: { type: String, required: true },
  transactionAmount: { type: Number, required: true },
  gateway: { type: String, required: true },
  planName: { type: String, required: true },
  planPrice: { type: Number, required: true }, // Price of the plan
  directBonus: { type: Number, required: true }, // Direct bonus points
  indirectBonus: { type: Number, required: true }, // Indirect bonus points
  DailyTaskLimit:{ type: Number, required: true },
  imagePath: { type: String, required: true },
  status: { type: String, default: 'pending' }
}, { timestamps: true });

const ReferralPaymentVerification = mongoose.model('ReferralPaymentVerification', referralPaymentSchema);
const ReferralApproveds = mongoose.model('ReferralApproveds', referralPaymentSchema);

// Referral Rejected Schema (unchanged)
const referralRejectedSchema = new mongoose.Schema({
  username: { type: String, required: true },
  transactionId: { type: String, required: true },
  transactionAmount: { type: Number, required: true },
  gateway: { type: String, required: true },
  imagePath: { type: String, required: true },
  reason: { type: String, required: true },
  status: { type: String, default: 'rejected' }
}, { timestamps: true });

const ReferralRejected = mongoose.model('ReferralRejected', referralRejectedSchema);

// Multer Storage Configuration (unchanged)
const referralStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, '../uploads/referral-plan-payment');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + Date.now() + ext);
  }
});

const uploadReferral = multer({ storage: referralStorage }).single('image'); // Check this line

// API Routes

app.post('/api/referral-payment/upload', uploadReferral, async (req, res) => {
  const { username, transactionId, transactionAmount, gateway, planName, planPrice, directBonus, indirectBonus, DailyTaskLimit } = req.body;

  // Validate required fields, including the image
  if (!username || !transactionId || !transactionAmount || !gateway || !planName || !planPrice || !directBonus || !indirectBonus || !DailyTaskLimit || !req.file) {
    return res.status(400).json({ message: 'All fields are required, including the image.' });
  }

  try {
    const newPayment = new ReferralPaymentVerification({
      username,
      transactionId,
      transactionAmount,
      gateway,
      planName,
      planPrice,
      directBonus,
      indirectBonus,
      DailyTaskLimit,
      imagePath: req.file.path  // Correctly saving the file path
    });

    await newPayment.save();

    res.json({ message: 'Referral payment request uploaded successfully.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// Fetch Referral Payment Verifications by Username
app.get('/api/referral-payment/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const payments = await ReferralPaymentVerification.find({ username }).populate('referrer', 'username');
    res.json(payments);
  } catch (error) {
    console.error('Error fetching referral payments:', error);
    res.status(500).json({ error: 'Failed to fetch referral payments.' });
  }
});
// Fetch approvals by username
app.get('/api/approvals/referral/approve/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const approvals = await ReferralApproveds.find({ username });
    res.json(approvals);
  } catch (error) {
    console.error('Error fetching approvals:', error);
    res.status(500).send('Server error');
  }
});

// Fetch rejected approvals by username
app.get('/api/approvals/referral/reject/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const rejectedApprovals = await ReferralRejected.find({ username });
    res.json(rejectedApprovals);
  } catch (error) {
    console.error('Error fetching rejected approvals:', error);
    res.status(500).send('Server error');
  }
});

app.get('/api/user/transactions/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const referralPayments = await ReferralPaymentVerification.find({ username });
    const approvedPayments = await ReferralApproveds.find({ username });
    const rejectedPayments = await ReferralRejected.find({ username });

    const transactions = [
      ...referralPayments.map(item => ({ ...item.toObject(), type: 'Referral Payment Verification', status: item.status })),
      ...approvedPayments.map(item => ({ ...item.toObject(), type: 'Approved Referral Payment', status: 'approved' })),
      ...rejectedPayments.map(item => ({ ...item.toObject(), type: 'Rejected Referral Payment', status: 'rejected' }))
    ];

    res.json(transactions);
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).send('Server error');
  }
});

// User Accounts Model
const userAccountsSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    gateway: { type: String, required: true },
    accountNumber: { type: String, required: true },
    accountTitle: { type: String, required: true }
  },
  { timestamps: true }
);

const UserAccounts = mongoose.model('UserAccounts', userAccountsSchema);

// ------------------||POST route to add user payment account||------------------------

app.post('/api/user-accounts/add', async (req, res) => {
  const { username, gateway, accountNumber, accountTitle } = req.body;

  try {
    // Create a new UserAccounts instance
    const newUserAccount = new UserAccounts({
      username,
      gateway,
      accountNumber,
      accountTitle
    });

    // Save to MongoDB
    await newUserAccount.save();

    // Respond with success message
    res.status(201).json({ message: 'Account added successfully.' });
  } catch (error) {
    console.error('Error adding account:', error);
    res.status(500).json({ error: 'Failed to add account.' });
  }
});
// ------------------||PUT route to edit user payment account||------------------------
app.put('/api/user-accounts/edit/:id', async (req, res) => {
  const { id } = req.params; // Account ID
  const { gateway, accountNumber, accountTitle } = req.body;

  try {
    // Find and update the account details by ID
    const updatedAccount = await UserAccounts.findByIdAndUpdate(
      id,
      { gateway, accountNumber, accountTitle },
      { new: true, runValidators: true } // Return the updated document and validate the input
    );

    if (!updatedAccount) {
      return res.status(404).json({ message: 'Account not found.' });
    }

    res.status(200).json({ message: 'Account updated successfully.', account: updatedAccount });
  } catch (error) {
    console.error('Error updating account:', error);
    res.status(500).json({ error: 'Failed to update account.' });
  }
});
// ------------------||DELETE route to remove user payment account||------------------------
app.delete('/api/user-accounts/delete/:id', async (req, res) => {
  const { id } = req.params; // Account ID

  try {
    // Find and delete the account by ID
    const deletedAccount = await UserAccounts.findByIdAndDelete(id);

    if (!deletedAccount) {
      return res.status(404).json({ message: 'Account not found.' });
    }

    res.status(200).json({ message: 'Account deleted successfully.', account: deletedAccount });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Failed to delete account.' });
  }
});

// ]-------------------||GET route to fetch user accounts by username||----------------------[

app.get('/api/user-accounts/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const accounts = await UserAccounts.find({ username });
    res.status(200).json(accounts);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Failed to fetch accounts.' });
  }
});

const userPendingSchema = new mongoose.Schema(
  {
    planName: { type: String, required: true },
    planPRICE: { type: Number, required: true },
    advancePoints: { type: Number, required: true },
    DirectPoint: { type: Number, required: true },
    IndirectPoint: { type: Number, required: true },
    refPer: { type: Number, required: true },
    refParentPer: { type: Number, required: true },
    referrerPin: { type: String, required: true, unique: true },
    referrerId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' }
  },
  { timestamps: true }
);

const UserPending = mongoose.model('UserPending', userPendingSchema);

// ]-----------------------||Endpoint for user signup||------------------------[

app.post('/api/signup', async (req, res) => {
  const { fullName, username, email, password, phoneNumber, referrerPin } = req.body;

  try {
    // Check if referrerPin exists in UserPending
    const userPending = await UserPending.findOne({ referrerPin });
    if (!userPending) {
      return res.status(400).json({ success: false, message: 'Invalid referrer PIN' });
    }

    // Check if the email or username already exists in the User model
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email or username already taken' });
    }

    // Create a new user based on the form data and UserPending document
    const newUser = new User({
      fullName,
      username,
      email,
      password,
      phoneNumber,
      plan: userPending.planName,
      rank: '',
      refPer: userPending.refPer,
      refParentPer: userPending.refParentPer,
      parent: userPending.referrerId,
      advancePoints: userPending.advancePoints,
      // Initialize other fields as needed
      balance: 0,
      totalPoints: 0,
      directPoints: 0,
      indirectPoints: 0,
      trainingBonusBalance: 0
    });

    // Save the new user to the database
    await newUser.save();
    await UserPending.findByIdAndRemove(userPending.id);

    // Respond with success
    res.status(201).json({ success: true, message: 'User registered successfully!' });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
  }
});

// ]----------------------------||Get Total Balance||-----------------------------[

app.get('/api/user/:username', async (req, res) => {
  try {
    const username = req.params.username;
    const user = await User.findOne({ username }).exec();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      phone: user.phoneNumber,
      balance: user.balance,
      totalPoints: user.totalPoints,
      advancePoints: user.advancePoints,
      trainingBonusBalance: user.trainingBonusBalance
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});
// Endpoint to get the count of direct referrals
// Endpoint to get the count of direct and indirect referrals
app.get('/api/referrals', async (req, res) => {
  const { username } = req.query;

  try {
    // Find the main user by username
    const mainUser = await User.findOne({ username });

    if (!mainUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Count direct referrals (users whose `referralDetails.referrer` matches the main user's _id)
    const directReferralsCount = await User.countDocuments({ 
      'referralDetails.referrer': mainUser._id 
    });

    // Find direct referrals to count indirect referrals
    const directReferrals = await User.find({ 
      'referralDetails.referrer': mainUser._id 
    });

    // Extract the IDs of direct referrals
    const directReferralIds = directReferrals.map(referral => referral._id);

    // Count indirect referrals (users whose `referralDetails.referrer` is one of the direct referral IDs)
    const indirectReferralsCount = await User.countDocuments({ 
      'referralDetails.referrer': { $in: directReferralIds } 
    });

    return res.json({
      DirectCount: directReferralsCount,
      IndirectCount: indirectReferralsCount,
    });
  } catch (error) {
    console.error('Error counting referrals:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// ----------------------||Api to handle Password change||----------------------
app.put('/api/change-password', async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;

  try {
    const user = await User.findOne({ username });

    if (!user || user.password !== currentPassword) {
      return res.status(401).json({ message: 'Invalid current password' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Internal server error' });
  }
});


// ----------------------||Notification||----------------------



const notificationSchema = new mongoose.Schema({
  userName: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['alert', 'message'], default: 'message' },
  timestamp: { type: Date, default: Date.now },
  status: { type: String, enum: ['read', 'unread'], default: 'unread' }
});

const Notification = mongoose.model('Notification', notificationSchema);


// API Endpoints
app.get('/api/notifications/:username', async (req, res) => {
  try {
    const notifications = await Notification.find({ userName: req.params.username });
    if (!notifications || notifications.length === 0) {
      return res.status(404).json({ message: 'No notifications found for this user' });
    }
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notifications', error: error.message });
  }
});

// Create a new notification
app.post('/api/notifications', async (req, res) => {
  const { userName, message, type } = req.body;

  try {
    const newNotification = new Notification({ userName, message, type });
    await newNotification.save();
    res.status(201).json(newNotification);
  } catch (error) {
    res.status(500).json({ message: 'Error creating notification', error: error.message });
  }
});

// Update a notification's status
app.put('/api/notifications/:id', async (req, res) => {
  const { status } = req.body;

  try {
    const updatedNotification = await Notification.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!updatedNotification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json(updatedNotification);
  } catch (error) {
    res.status(500).json({ message: 'Error updating notification status', error: error.message });
  }
});



//------------------------||WithdrawalRequest Schema (Client Side)||--------------------------

const withdrawalRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    accountNumber: {
      type: String,
      required: true
    },
    accountTitle: {
      type: String,
      required: true
    },
    gateway: {
      type: String,
      required: true
    },
    remarks: {
      type: String,
      default: null // This field is for admin remarks, especially in case of rejection
    }
  },
  { timestamps: true }
);

const WithdrawalRequest = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);



const systemSettingsSchema = new mongoose.Schema({
  withdrawalEnabled: {
    type: Boolean,
    default: true, // Default to withdrawals being enabled
  },
});

const SystemSettings = mongoose.model('SystemSettings', systemSettingsSchema);


// Middleware to check withdrawal status
const checkWithdrawalStatus = async (req, res, next) => {
  try {
    const settings = await SystemSettings.findOne();
    if (!settings || !settings.withdrawalEnabled) {
      return res.status(403).json({ message: 'Withdrawals are currently disabled' });
    }
    next();
  } catch (error) {
    console.error('Error checking withdrawal status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


// Get current withdrawal status
app.get('/api/settings/withdrawal-status', async (req, res) => {
  try {
    const settings = await SystemSettings.findOne();
    if (!settings) {
      return res.status(404).json({ message: 'Settings not found' });
    }
    res.status(200).json({ withdrawalEnabled: settings.withdrawalEnabled });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching withdrawal status', error });
  }
});


// Submit a withdrawal request
app.post('/api/withdraw-balance', checkWithdrawalStatus, async (req, res) => {
  const { username, withdrawAmount, gateway, accountNumber, accountTitle } = req.body;

  try {
    // Get current day and time
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const currentHour = now.getHours(); // 0 to 23

    // Check if the current day and time are within the allowed range
    if (currentDay < 1 || currentDay > 4 || currentHour < 10 || currentHour >= 22) {
      return res.status(403).json({
        message: 'Withdrawals are allowed only from Monday to Thursday, between 10:00 AM and 10:00 PM.'
      });
    }

    // Find the user by username
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if the user's balance is sufficient
    if (user.balance < withdrawAmount) {
      return res.status(400).json({ message: 'Insufficient balance for withdrawal.' });
    }

    // Create and save new withdrawal request (Balance not deducted here; status is pending)
    const newWithdrawalRequest = new WithdrawalRequest({
      userId: user._id,
      amount: withdrawAmount,
      accountNumber,
      accountTitle,
      gateway,
      status: 'pending', // Status is pending by default
    });
    await newWithdrawalRequest.save();

    res.status(200).json({
      message: 'Withdrawal request submitted successfully.',
      requestId: newWithdrawalRequest._id
    });
  } catch (error) {
    console.error('Error processing withdrawal request:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Fetch withdrawal requests (Transactions) for the user
app.get('/api/withdrawals/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Fetch all withdrawal requests (acts as transactions)
    const withdrawalRequests = await WithdrawalRequest.find({ userId: user._id }).sort({ createdAt: -1 });

    res.json(withdrawalRequests); // Return the request with status and remarks (if any)
  } catch (error) {
    console.error('Error fetching withdrawal history:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


app.get('/api/users/product-profit-history/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user.productProfitHistory);
  } catch (error) {
    console.error('Error fetching product profit history:', error);
    res.status(500).json({ message: 'Failed to fetch product profit history' });
  }
});



// Get Parent User Name
app.get('/api/user/:userId/parent', async (req, res) => {
  try {
    // Find the user based on the provided username
    const user = await User.findOne({ username: req.params.userId });

    // Check if the user exists
    if (!user) {
      return res.status(404).send('User not found');
    }

    // Check if the user has a parent ID
    if (!user.parent) {
      return res.status(404).send('No parent found for this user');
    }

    // Fetch the parent user details using the parent ID
    const parent = await User.findById(user.parent).select('fullName username');

    // Check if the parent exists
    if (!parent) {
      return res.status(404).send('Parent user not found');
    }

    // Return the parent's details
    res.send({ parent });

  } catch (err) {
    res.status(500).send(err);
  }
});

// Multer storage configuration for profile pictures
const profilePictureStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/profile-pictures')); // Ensure correct path
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, 'profile-' + Date.now() + ext); // Use a unique name for the profile picture
  }
});

// Create the multer instance
const profileUpload = multer({ storage: profilePictureStorage });


// Your route for uploading profile pictures
app.post('/api/user/:username/profile-picture', profileUpload.single('profilePicture'), (req, res) => {
  const filePath = `uploads/profile-pictures/${req.file.filename}`; // Save as a relative path

  // Save the file path in the user document in the database
  User.findOneAndUpdate({ username: req.params.username }, { profilePicture: filePath }, { new: true })
    .then(user => {
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json({ user });
    })
    .catch(err => {
      console.error('Error saving profile picture:', err);
      res.status(500).json({ message: 'Error saving profile picture' });
    });
});


// Route to update user information including the profile picture
app.put('/api/user/:username', profileUpload.single('profilePicture'), async (req, res) => {
  const { username } = req.params;
  const { fullName, email, phoneNumber } = req.body;

  try {
    const updates = { fullName, email, phoneNumber };

    if (req.file) {
      updates.profilePicture = `uploads/profile-pictures/${req.file.filename}`; // Save as relative path
    }

    const user = await User.findOneAndUpdate({ username }, updates, { new: true });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User updated successfully', user });
  } catch (error) {
    if (error instanceof multer.MulterError) {
      console.error('Multer Error:', error);
      return res.status(400).json({ message: error.message });
    }
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});



//------------------------|whatsappChat page backend||--------------------------

// Define Mongoose Schema for WhatsApp Contacts
const whatsappContactSchema = new mongoose.Schema({
  whatsappNumber: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  phoneNumber: { type: String, required: true },
}, { timestamps: true });

const WhatsappContact = mongoose.model('WhatsappContact', whatsappContactSchema);


// Get all WhatsApp contacts
app.get('/api/admin/whatsapp/contacts', async (req, res) => {
  try {
    const contacts = await WhatsappContact.find();
    res.json({ contacts });
  } catch (err) {
    console.error('Error fetching WhatsApp contacts:', err);
    res.status(500).json({ message: 'Server error' });
  }
});
