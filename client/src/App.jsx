import { useState, useEffect, useCallback } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  LayoutDashboard,
  Users,
  HandCoins,
  Repeat,
  Wallet,
  LogOut,
} from 'lucide-react';
import { clearLocalDatabase } from './db/dexieDb.js';
import { apiRequest } from './services/api.js';
import { syncWithServer } from './services/syncService.js';
import DashboardPage from './pages/DashboardPage.jsx';
import ClientesPage from './pages/ClientesPage.jsx';
import CobrosPage from './pages/CobrosPage.jsx';
import TandasPage from './pages/TandasPage.jsx';
import GastosPage from './pages/GastosPage.jsx';
import EstadoCuentaPublico from './pages/EstadoCuentaPublico.jsx';

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user_data');
    return saved ? JSON.parse(saved) : null;
  });
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('inicio');
  const [inicioResetKey, setInicioResetKey] = useState(0);

  // Estados para Login / Registro
  const [isRegister, setIsRegister] = useState(false);
  const [formAuth, setFormAuth] = useState({
    nombre: '',
    negocio_nombre: 'Aromas y Bienestar',
    email: '',
    password: '',
  });
  const [authError, setAuthError] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(false);

  const publicMatch = window.location.pathname.match(/^\/estado-cuenta\/([0-9a-f-]{36})$/i);

  const handleSync = useCallback(async () => {
    if (!navigator.onLine || !localStorage.getItem('auth_token')) return;
    setSyncing(true);
    try {
      await syncWithServer();
    } catch (err) {
      console.error('Error al sincronizar:', err.message);
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      handleSync();
    };
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [handleSync]);

  useEffect(() => {
    if (user && isOnline && !publicMatch) {
      handleSync();
    }
  }, [user, isOnline, publicMatch, handleSync]);

  if (publicMatch) {
    return <EstadoCuentaPublico token={publicMatch[1]} />;
  }

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setLoadingAuth(true);

    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const payload = isRegister
        ? formAuth
        : { email: formAuth.email, password: formAuth.password };

      const data = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      localStorage.setItem('auth_token', data.token);
      localStorage.setItem('user_data', JSON.stringify(data.usuario));
      setUser(data.usuario);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    await clearLocalDatabase();
    setUser(null);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-100">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
          <div className="text-center mb-6">
            <img src="/pwa-icon.svg" alt="Logo" className="w-16 h-16 mx-auto mb-3" />
            <h1 className="text-2xl font-bold text-slate-800">Mis Cobros y Tandas</h1>
            <p className="text-sm text-slate-500">Control móvil inteligente (Online y Offline)</p>
          </div>

          <div className="flex rounded-xl bg-slate-100 p-1 mb-5">
            <button
              type="button"
              onClick={() => setIsRegister(false)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${
                !isRegister ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => setIsRegister(true)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${
                isRegister ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-600'
              }`}
            >
              Crear Cuenta
            </button>
          </div>

          {authError && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-200">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {isRegister && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Tu Nombre</label>
                  <input
                    type="text"
                    required
                    value={formAuth.nombre}
                    onChange={(e) => setFormAuth({ ...formAuth, nombre: e.target.value })}
                    placeholder="Ej. Elena Morales"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Nombre de tu Negocio
                  </label>
                  <input
                    type="text"
                    required
                    value={formAuth.negocio_nombre}
                    onChange={(e) => setFormAuth({ ...formAuth, negocio_nombre: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-teal-600"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Correo Electrónico
              </label>
              <input
                type="email"
                required
                value={formAuth.email}
                onChange={(e) => setFormAuth({ ...formAuth, email: e.target.value })}
                placeholder="correo@ejemplo.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-teal-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Contraseña</label>
              <input
                type="password"
                required
                minLength={6}
                value={formAuth.password}
                onChange={(e) => setFormAuth({ ...formAuth, password: e.target.value })}
                placeholder="Mínimo 6 caracteres"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-teal-600"
              />
            </div>

            <button
              type="submit"
              disabled={loadingAuth}
              className="w-full py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold shadow-sm transition disabled:opacity-60"
            >
              {loadingAuth ? 'Conectando...' : isRegister ? 'Registrarme y Entrar' : 'Entrar al Sistema'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const navItems = [
    {
      id: 'inicio',
      label: 'Inicio',
      icon: LayoutDashboard,
      iconColor: 'text-teal-700',
      activeBg: 'bg-teal-50 text-teal-800',
    },
    {
      id: 'clientes',
      label: 'Clientes',
      icon: Users,
      iconColor: 'text-sky-600',
      activeBg: 'bg-sky-50 text-sky-800',
    },
    {
      id: 'cobros',
      label: 'Cobros',
      icon: HandCoins,
      iconColor: 'text-emerald-600',
      activeBg: 'bg-emerald-50 text-emerald-800',
    },
    {
      id: 'tandas',
      label: 'Tandas',
      icon: Repeat,
      iconColor: 'text-indigo-600',
      activeBg: 'bg-indigo-50 text-indigo-800',
    },
    {
      id: 'gastos',
      label: 'Gastos',
      icon: Wallet,
      iconColor: 'text-rose-600',
      activeBg: 'bg-rose-50 text-rose-800',
    },
  ];

  return (
    <div className="min-h-screen pb-20 max-w-lg mx-auto bg-slate-50 shadow-sm border-x border-slate-200">
      {/* Cabecera fija */}
      <header className="sticky top-0 z-20 bg-teal-700 text-white px-4 py-3 flex items-center justify-between shadow">
        <div>
          <h1 className="font-bold text-base leading-tight">{user.negocio_nombre}</h1>
          <p className="text-xs text-teal-100">Hola, {user.nombre}</p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
              isOnline ? 'bg-emerald-500/20 text-emerald-100' : 'bg-amber-500 text-slate-900'
            }`}
          >
            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
            {isOnline ? 'En línea' : 'Sin red'}
          </span>

          <button
            onClick={handleSync}
            disabled={!isOnline || syncing}
            title="Sincronizar ahora"
            className="p-2 rounded-lg bg-teal-800 hover:bg-teal-900 disabled:opacity-40"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="p-2 rounded-lg bg-teal-800 hover:bg-red-700"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Contenido por pestaña */}
      <main className="p-4">
        {activeTab === 'inicio' && (
          <DashboardPage
            key={inicioResetKey}
            user={user}
            onNavigate={setActiveTab}
            isOnline={isOnline}
            syncing={syncing}
            onSync={handleSync}
          />
        )}
        {activeTab === 'clientes' && <ClientesPage />}
        {activeTab === 'cobros' && <CobrosPage />}
        {activeTab === 'tandas' && <TandasPage user={user} />}
        {activeTab === 'gastos' && <GastosPage />}
      </main>

      {/* Barra de navegación inferior con íconos a color */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white border-t border-slate-200 px-2 py-1.5 flex justify-around z-20">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'inicio' && activeTab === 'inicio') {
                  setInicioResetKey((k) => k + 1);
                }
                setActiveTab(item.id);
              }}
              className={`flex flex-col items-center py-1.5 px-3 rounded-xl text-xs transition ${
                active
                  ? `${item.activeBg} font-bold shadow-2xs`
                  : 'text-slate-600 font-medium hover:bg-slate-100'
              }`}
            >
              <Icon size={21} className={`mb-0.5 ${item.iconColor}`} />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}