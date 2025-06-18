// Middleware
app.use(express.json());
app.use(express.static('public'));

// Routes
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);

// Serve admin panel
app.get('/admin', (req, res) => {
    console.log('Admin panel requested');
    res.sendFile(path.join(__dirname, 'views', 'admin-panel.html'));
});

// Admin menu routes
app.get('/nuevo-reclamo', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'nuevo-reclamo.html'));
});

app.get('/lista-reclamos', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'lista-reclamos.html'));
});

app.get('/estadisticas', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'estadisticas.html'));
});

app.get('/repartidores', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'repartidores.html'));
});

// Serve dashboard
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});