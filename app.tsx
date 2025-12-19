
import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { Screen } from './types';
import { supabase } from './supabaseClient';

// Fix for properties on Window
declare global {
    interface Window {
        google: any;
        gm_authFailure?: boolean;
    }
}

// --- TYPE DEFINITIONS ---
type Session = any;
type User = any;
type Profile = {
    id: string;
    full_name: string;
    phone?: string | null;
    latitude?: number;
    longitude?: number;
    fcm_token?: string | null;
};
type Ride = {
    id: number;
    from_location: string;
    to_location: string;
    estimated_price: string;
    final_price: string | null;
    created_at: string;
    vehicle_type: string | null;
    user_id: string;
    driver_id: string | null;
    status: 'searching' | 'driver_en_route' | 'in_progress' | 'completed' | 'cancelled';
    rating: number | null;
};
type ScheduledRide = {
    id: number;
    user_id: string;
    from_location: string;
    to_location: string;
    vehicle_type: string;
    scheduled_for: string;
    status: string;
    created_at: string;
};
type Driver = {
    id: string;
    is_active: boolean;
    status: 'offline' | 'online' | 'in_ride';
    current_latitude: number | null;
    current_longitude: number | null;
};

type DriverDetails = {
    full_name: string;
    vehicle_model: string;
    vehicle_color: string | null;
    license_plate: string;
};

interface PaymentMethod {
    id: number;
    type: 'Cartão' | 'Pix' | 'Dinheiro';
    details: string | null;
    is_selected: boolean;
}

type ChatMessage = {
    id: number;
    ride_id: number;
    sender_id: string;
    receiver_id: string;
    message_content: string;
    created_at: string;
};

type Tariff = {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  min_fare: number;
  per_km: number;
  per_min: number;
};

// --- APP CONTEXT & STATE ---
interface RideState {
    stage: 'none' | 'confirming_details' | 'searching' | 'driver_en_route' | 'in_progress' | 'rating';
    from: string | null;
    to: string | null;
    originLat: number | null;
    originLng: number | null;
    stops: string[];
    vehicle: 'Simples' | 'Conforto' | null;
    estimatedPrice: string | null;
    rideId: number | null;
    driverId: string | null;
    driverDetails: DriverDetails | null;
}

const initialRideState: RideState = {
    stage: 'none',
    from: null,
    to: null,
    originLat: null,
    originLng: null,
    stops: [],
    vehicle: null,
    estimatedPrice: null,
    rideId: null,
    driverId: null,
    driverDetails: null
};

interface AppContextType {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
    signOut: () => void;
    navigate: (screen: Screen, options?: { fromRideFlow?: boolean }) => void;
    rideState: RideState;
    setRideState: React.Dispatch<React.SetStateAction<RideState>>;
    paymentMethods: PaymentMethod[];
    setPaymentMethods: React.Dispatch<React.SetStateAction<PaymentMethod[]>>;
    refreshPaymentMethods: () => Promise<void>;
    navigationOrigin: Screen | null;
}

const AppContext = createContext<AppContextType | null>(null);

const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};

// --- HELPER FUNCTIONS ---
const getInitials = (name: string | null | undefined): string => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
};

const calculatePrice = async (distanceInKm: number, durationInMinutes: number): Promise<number> => {
    const now = new Date();
    const timeFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
    const currentTime = timeFormatter.format(now);
    try {
        const { data, error } = await supabase.from('tariffs').select('*').lte('start_time', currentTime).gte('end_time', currentTime).single();
        if (error || !data) {
             return Math.max((distanceInKm * 2) + (durationInMinutes * 0.5), 6.00);
        }
        const tariff = data as Tariff;
        return Math.max((distanceInKm * tariff.per_km) + (durationInMinutes * tariff.per_min), tariff.min_fare);
    } catch (e) {
        return Math.max((distanceInKm * 2) + (durationInMinutes * 0.5), 6.00);
    }
};

// --- ICONS & UI COMPONENTS ---
const Logo: React.FC<{ className?: string }> = ({ className }) => <h1 className={`text-5xl font-bold tracking-tighter text-white ${className}`}>Move</h1>;
const GoogleIcon: React.FC = () => (
    <svg className="w-6 h-6 mr-3" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039L38.802 9.98C34.553 6.136 29.613 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path>
        <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.841-5.841C34.553 6.136 29.613 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path>
        <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"></path>
        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.012 35.254 44 30.022 44 24c0-1.341-.138-2.65-.389-3.917z"></path>
    </svg>
);
const AppleIcon: React.FC = () => (
    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
       <path d="M12.01,21.35c-1.4,0-2.86-0.67-3.8-1.92c-1.9-2.52-2.22-5.9-0.8-8.83c0.75-1.54,2.06-2.63,3.59-2.63 c0.97,0,2.15,0.58,2.99,0.58c0.83,0,1.79-0.56,2.83-0.56c1.83,0,3.1,1.17,3.92,2.83c-1.65,1-2.7,2.8-2.7,4.8 c0,3.23,2.51,4.41,2.8,4.5c-0.28,0.11-1.29,0.56-2.63,0.56c-1.49,0-2.34-0.89-3.83-0.89C14.01,20.46,13.1,21.35,12.01,21.35z M16.4,7.49c0.41-1.39,1.55-2.61,2.91-3.23c-1.43-1.02-3.23-1.18-4.44-0.22c-1.2,0.96-2.09,2.4-2.2,3.95 c1.53,0.21,3.12-0.59,3.73-0.49Z" />
    </svg>
);
const MenuIcon: React.FC = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>;
const CheckCircleIcon: React.FC = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-green-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const SearchIcon: React.FC<{ className?: string }> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
const LocationTargetIcon: React.FC<{ className?: string }> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={`h-7 w-7 text-gray-700 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" /><path d="M12 15a3 3 0 1 0-3-3 3 3 0 0 0 3 3z" /></svg>;
const CreditCardIcon: React.FC<{ className?: string }> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;
const PixIcon: React.FC<{ className?: string }> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
const CashIcon: React.FC<{ className?: string }> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
const EditIcon: React.FC<{ className?: string }> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${className}`} viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const CarSimpleIcon: React.FC<{ className?: string }> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} stroke="none" className={`w-8 h-8 ${className}`}><path d="M19.92,4.62A20.24,20.24,0,0,0,12,2a20.24,20.24,0,0,0-7.92,2.62.5.5,0,0,0-.23.63L6,11H2.5a.5.5,0,0,0-.5.5v3a.5.5,0,0,0,.5.5H6l2.15,7.25a.5.5,0,0,0,.46.38h6.78a.5.5,0,0,0,.46-.38L18,15h3.5a.5.5,0,0,0,.5-.5v-3a.5.5,0,0,0-.5-.5H18L19.75,5.25A.5.5,0,0,0,19.92,4.62ZM8,13,6.88,9h10.24L16,13ZM12,4a18.29,18.29,0,0,1,6.58,2.25L17.13,8H6.87L5.42,6.25A18.29,18.29,0,0,1,12,4Z"/></svg>;
const CarComfortIcon: React.FC<{ className?: string }> = ({ className }) => <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} stroke="none" className={`w-8 h-8 ${className}`}><path d="M22.68,8.23,21,4.75A3,3,0,0,0,18.25,3H5.75A3,3,0,0,0,3,4.75L1.32,8.23a3,3,0,0,0,0,2.54L3,14.25A3,3,0,0,0,5.75,16h.25v2.25a.75.75,0,0,0,.75.75h1.5a.75.75,0,0,0,.75-.75V16h5v2.25a.75.75,0,0,0,.75.75h1.5a.75.75,0,0,0,.75-.75V16h.25A3,3,0,0,0,21,14.25l1.68-3.48A3,3,0,0,0,22.68,8.23ZM5.75,4.5h12.5a1.5,1.5,0,0,1,1.38.75l1,2H3.37l1-2A1.5,1.5,0,0,1,5.75,4.5ZM20.32,11.5H3.68L2.3,13.37A1.5,1.5,0,0,0,3.68,14.5h16.64a1.5,1.5,0,0,0,1.38-1.13Z"/></svg>;

const paymentMethodIcons = { 'Cartão': CreditCardIcon, 'Pix': PixIcon, 'Dinheiro': CashIcon };

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
    <input ref={ref} {...props} className={`w-full px-4 py-3 bg-gray-100 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-slate-500 transition disabled:opacity-50 disabled:cursor-not-allowed ${className || ''}`} />
));

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { children: React.ReactNode; variant?: 'primary' | 'secondary' | 'social' | 'danger'; }
const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', className = '', ...props }) => {
    const baseClasses = "w-full py-3 font-semibold rounded-lg shadow-md flex items-center justify-center transition";
    const variants = { primary: "bg-slate-800 text-white hover:bg-slate-700", secondary: "bg-gray-200 text-slate-800 hover:bg-gray-300", social: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50", danger: "bg-red-500 text-white hover:bg-red-600" };
    return <button {...props} className={`${baseClasses} ${variants[variant]} ${className}`}>{children}</button>;
};

const ScreenWrapper: React.FC<{ title: string; onBack: () => void; children: React.ReactNode }> = ({ title, onBack, children }) => (
    <div className="w-full h-full bg-gray-50 flex flex-col animate-fade-in">
        <header className="bg-white shadow-sm p-4 flex items-center flex-shrink-0 z-10"><button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 mr-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button><h2 className="text-xl font-semibold text-slate-800">{title}</h2></header>
        <main className="flex-grow p-6 overflow-y-auto">{children}</main>
    </div>
);

// --- SCREEN COMPONENTS ---
const SplashScreen: React.FC = () => (
    <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center animate-fade-in">
        <Logo /><div className="absolute bottom-16 flex space-x-2"><div className="w-3 h-3 bg-white rounded-full animate-pulse [animation-delay:-0.3s]"></div><div className="w-3 h-3 bg-white rounded-full animate-pulse [animation-delay:-0.1s]"></div><div className="w-3 h-3 bg-white rounded-full animate-pulse"></div></div>
    </div>
);

const LoginScreen: React.FC = () => {
    const { navigate } = useAppContext();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault(); setLoading(true); setError(null);
        try { const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error; } 
        catch (err: any) { setError(err.message || "Erro ao entrar."); } finally { setLoading(false); }
    };
    return (
        <div className="w-full h-full bg-white flex flex-col justify-center p-8 animate-fade-in">
            <div className="mb-10 text-center"><h2 className="text-3xl font-bold text-slate-800">Entrar na sua conta</h2><p className="text-gray-500 mt-2">Use e-mail ou redes sociais</p></div>
            {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-center">{error}</p>}
            <form onSubmit={handleLogin} className="space-y-4"><Input placeholder="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} required /><Input placeholder="Senha" type="password" value={password} onChange={e => setPassword(e.target.value)} required /><Button type="submit" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</Button></form>
            <a onClick={() => navigate(Screen.ForgotPassword)} className="text-sm text-slate-600 hover:underline text-center block mt-4 cursor-pointer">Esqueceu sua senha?</a>
            <div className="flex items-center my-6"><hr className="flex-grow border-gray-300" /><span className="mx-4 text-gray-400 font-medium">ou</span><hr className="flex-grow border-gray-300" /></div>
            <div className="space-y-3"><Button variant="social" onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })}><GoogleIcon />Entrar com Google</Button><Button variant="social" className="text-black" onClick={() => supabase.auth.signInWithOAuth({ provider: 'apple' })}><AppleIcon />Entrar com Apple</Button></div>
            <p className="text-center text-sm text-gray-500 mt-8">Ainda não tem conta? <a onClick={() => navigate(Screen.SignUp)} className="font-semibold text-slate-600 hover:underline cursor-pointer">Cadastre-se</a></p>
        </div>
    );
};

const SignUpScreen: React.FC = () => {
    const { navigate } = useAppContext();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault(); if (password !== confirmPassword) { setError("Senhas não coincidem."); return; }
        setLoading(true); setError(null);
        try { const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, phone: phone } } }); if (error) throw error; navigate(Screen.SignUpSuccess); } 
        catch (err: any) { setError(err.message || "Erro ao cadastrar."); } finally { setLoading(false); }
    };
    return (
        <div className="w-full h-full bg-white flex flex-col justify-center p-8 animate-fade-in">
            <div className="mb-8 text-center"><h2 className="text-3xl font-bold text-slate-800">Criar Conta</h2><p className="text-gray-500 mt-2">É rápido e fácil!</p></div>
            {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-center">{error}</p>}
            <form onSubmit={handleSignUp} className="space-y-4"><Input placeholder="Nome completo" value={fullName} onChange={e => setFullName(e.target.value)} required /><Input placeholder="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} required /><Input placeholder="Celular" type="tel" value={phone} onChange={e => setPhone(e.target.value)} /><Input placeholder="Senha" type="password" value={password} onChange={e => setPassword(e.target.value)} required /><Input placeholder="Confirmar senha" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required /><Button type="submit" disabled={loading}>{loading ? 'Cadastrando...' : 'Cadastrar'}</Button></form>
            <p className="text-center text-sm text-gray-500 mt-8">Já tem conta? <a onClick={() => navigate(Screen.Login)} className="font-semibold text-slate-600 hover:underline cursor-pointer">Entrar</a></p>
        </div>
    );
};

const SignUpSuccessScreen: React.FC = () => {
    const { navigate } = useAppContext();
    return (
        <div className="w-full h-full bg-white flex flex-col items-center justify-center p-8 text-center animate-fade-in">
            <CheckCircleIcon /><h2 className="text-3xl font-bold text-slate-800 mt-6">Cadastro realizado!</h2><p className="text-gray-600 mt-2 max-w-sm">Verifique seu e-mail para confirmar a conta.</p>
            <div className="mt-8 w-full max-w-xs"><Button onClick={() => navigate(Screen.Login)}>Voltar para o Login</Button></div>
        </div>
    );
};

const ForgotPasswordScreen: React.FC = () => {
    const { navigate } = useAppContext();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const handleSendLink = async (e: React.FormEvent) => {
        e.preventDefault(); setLoading(true); setMessage(''); setError('');
        try { const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin }); if (error) throw error; setMessage('Link enviado!'); } 
        catch (err: any) { setError(err.message || 'Falha ao enviar.'); } finally { setLoading(false); }
    };
    return (
        <ScreenWrapper title="Esqueci a Senha" onBack={() => navigate(Screen.Login)}>
            <div className="space-y-6"><p className="text-gray-600 text-center">Digite seu e-mail para o link de redefinição.</p>
            {message && <p className="bg-green-100 text-green-700 p-3 rounded-lg text-center">{message}</p>}
            {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg text-center">{error}</p>}
            <form onSubmit={handleSendLink} className="space-y-4"><Input placeholder="Seu e-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} required /><Button type="submit" disabled={loading}>{loading ? 'Enviando...' : 'Enviar Link'}</Button></form></div>
        </ScreenWrapper>
    );
};

const ResetPasswordScreen: React.FC = () => {
    const { navigate } = useAppContext();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault(); if (password !== confirmPassword) { setError('Senhas não coincidem.'); return; }
        setLoading(true); setError('');
        try { const { error } = await supabase.auth.updateUser({ password }); if (error) throw error; setMessage('Senha atualizada!'); setTimeout(() => navigate(Screen.Login), 2000); } 
        catch (err: any) { setError(err.message || 'Falha ao redefinir.'); } finally { setLoading(false); }
    };
    return (
        <div className="w-full h-full bg-white flex flex-col justify-center p-8 animate-fade-in">
            <div className="mb-8 text-center"><h2 className="text-3xl font-bold text-slate-800">Redefinir Senha</h2><p className="text-gray-500 mt-2">Crie uma nova senha.</p></div>
            {message && <p className="bg-green-100 text-green-700 p-3 rounded-lg mb-4 text-center">{message}</p>}
            {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-center">{error}</p>}
            <form onSubmit={handleReset} className="space-y-4"><Input placeholder="Nova senha" type="password" value={password} onChange={e => setPassword(e.target.value)} required /><Input placeholder="Confirmar nova senha" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required /><Button type="submit" disabled={loading || !!message}>{loading ? 'Salvando...' : 'Salvar Nova Senha'}</Button></form>
        </div>
    );
};

const MainMapScreen: React.FC = () => {
    const { navigate, rideState, setRideState } = useAppContext();
    const mapRef = useRef<HTMLDivElement>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    useEffect(() => {
        if (mapRef.current && window.google) {
            new window.google.maps.Map(mapRef.current, { center: { lat: -23.5505, lng: -46.6333 }, zoom: 12, disableDefaultUI: true });
        }
    }, []);
    return (
        <div className="w-full h-full relative overflow-hidden">
            <div ref={mapRef} className="w-full h-full bg-gray-200" />
            <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
            <div className="absolute top-5 left-5 right-5 bg-white rounded-lg shadow-lg flex items-center p-3 z-10 space-x-2">
                <button onClick={() => setIsMenuOpen(true)} className="p-2 rounded-full hover:bg-gray-100"><MenuIcon /></button>
                <div className="flex-grow cursor-pointer p-2" onClick={() => navigate(Screen.SearchDestination)}><span className="text-lg text-gray-500">Para onde vamos?</span></div>
            </div>
            {rideState.stage !== 'none' && <RideRequestSheet />}
        </div>
    );
};

const SearchDestinationScreen: React.FC = () => {
    const { navigate, setRideState } = useAppContext();
    const [from, setFrom] = useState('Endereço Atual');
    const [to, setTo] = useState('');
    const handleConfirm = () => {
        setRideState(prev => ({ ...prev, stage: 'confirming_details', from, to }));
        navigate(Screen.MainMap);
    };
    return (
        <div className="w-full h-full bg-white flex flex-col">
            <header className="p-4 flex items-center border-b"><button onClick={() => navigate(Screen.MainMap)} className="p-2 mr-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button><h2 className="text-xl font-semibold">Definir Rota</h2></header>
            <main className="p-4 space-y-4"><Input placeholder="Local de partida" value={from} onChange={e => setFrom(e.target.value)} /><Input placeholder="Para onde?" value={to} onChange={e => setTo(e.target.value)} /></main>
            <footer className="p-4"><Button onClick={handleConfirm} disabled={!to.trim()}>Confirmar Rota</Button></footer>
        </div>
    );
};

const ProfileScreen: React.FC = () => <ScreenWrapper title="Meu Perfil" onBack={() => useAppContext().navigate(Screen.MainMap)}><p>Configurações de Perfil</p></ScreenWrapper>;
const HistoryScreen: React.FC = () => <ScreenWrapper title="Histórico" onBack={() => useAppContext().navigate(Screen.MainMap)}><p>Suas viagens passadas</p></ScreenWrapper>;
const PaymentsScreen: React.FC = () => <ScreenWrapper title="Pagamentos" onBack={() => useAppContext().navigate(Screen.MainMap)}><p>Métodos de pagamento</p></ScreenWrapper>;
const SupportScreen: React.FC = () => <ScreenWrapper title="Suporte" onBack={() => useAppContext().navigate(Screen.MainMap)}><p>Ajuda e suporte</p></ScreenWrapper>;
const SettingsScreen: React.FC = () => <ScreenWrapper title="Configurações" onBack={() => useAppContext().navigate(Screen.MainMap)}><p>Configurações do App</p></ScreenWrapper>;
const ScheduledRidesScreen: React.FC = () => <ScreenWrapper title="Agendadas" onBack={() => useAppContext().navigate(Screen.MainMap)}><p>Viagens agendadas</p></ScreenWrapper>;
const AddCardScreen: React.FC = () => <ScreenWrapper title="Cartão" onBack={() => useAppContext().navigate(Screen.Payments)}><p>Adicionar cartão</p></ScreenWrapper>;
const ChatScreen: React.FC = () => <ScreenWrapper title="Chat" onBack={() => useAppContext().navigate(Screen.MainMap)}><p>Conversa com o motorista</p></ScreenWrapper>;

const RideRequestSheet = () => {
    const { setRideState } = useAppContext();
    return (
        <div className="absolute bottom-0 left-0 right-0 bg-white p-6 rounded-t-2xl shadow-2xl z-20 space-y-4">
            <h2 className="text-xl font-bold">Viagem Solicitada</h2><p className="text-gray-600">Procurando motorista...</p>
            <Button variant="danger" onClick={() => setRideState(initialRideState)}>Cancelar</Button>
        </div>
    );
};

const SideMenu: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const { profile, navigate, signOut } = useAppContext();
    const items = [ {l: 'Perfil', s: Screen.Profile}, {l: 'Histórico', s: Screen.History}, {l: 'Pagamentos', s: Screen.Payments}, {l: 'Agendadas', s: Screen.ScheduledRides}, {l: 'Configurações', s: Screen.Settings} ];
    return (
        <div className={`fixed inset-0 z-50 transition-all ${isOpen ? 'visible' : 'invisible'}`}>
            <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
            <div className={`absolute left-0 top-0 bottom-0 w-64 bg-white transition-transform ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="bg-slate-800 p-6 text-white"><p className="text-lg font-bold">{profile?.full_name || 'Usuário'}</p></div>
                <nav className="p-4 space-y-2">{items.map(i => <a key={i.l} className="block p-2 hover:bg-gray-100 cursor-pointer" onClick={() => { navigate(i.s); onClose(); }}>{i.l}</a>)}</nav>
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t"><a onClick={signOut} className="text-red-500 cursor-pointer">Sair</a></div>
            </div>
        </div>
    );
};

// --- MAIN APP COMPONENT ---
const App: React.FC = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.SplashScreen);
    const [loading, setLoading] = useState(true);
    const [rideState, setRideState] = useState<RideState>(initialRideState);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    
    // Recovery lock strictly prevents auto-navigation to Map
    const recoveryInProgress = useRef(false);

    const refreshData = async (u: User) => {
        try {
            const { data } = await supabase.from('profiles').select('*').eq('id', u.id).single();
            if (data) setProfile(data as Profile);
        } catch (e) {}
    };

    useEffect(() => {
        // Immediate detection of recovery mode in URL
        const isRec = window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery');
        if (isRec) {
            recoveryInProgress.current = true;
            setLoading(true); // Keep splash active
        }

        const handleInit = async (s: Session) => {
            if (s?.user) {
                setUser(s.user);
                await refreshData(s.user);
                // IF NOT RECOVERING: go to Map. IF RECOVERING: wait for event.
                if (!recoveryInProgress.current) {
                    setCurrentScreen(Screen.MainMap);
                    setLoading(false);
                }
            } else {
                if (!recoveryInProgress.current) {
                    setCurrentScreen(Screen.Login);
                    setLoading(false);
                }
            }
        };

        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            handleInit(session);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log("Auth Event:", event);
            if (event === 'PASSWORD_RECOVERY') {
                recoveryInProgress.current = true;
                setSession(session);
                setUser(session?.user);
                setCurrentScreen(Screen.ResetPassword);
                setLoading(false);
            } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
                if (!recoveryInProgress.current) {
                    setSession(session);
                    handleInit(session);
                }
            } else if (event === 'SIGNED_OUT') {
                recoveryInProgress.current = false;
                setSession(null);
                setUser(null);
                setCurrentScreen(Screen.Login);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const value: AppContextType = {
        session, user, profile, setProfile, signOut: () => supabase.auth.signOut(), navigate: setCurrentScreen,
        rideState, setRideState, paymentMethods, setPaymentMethods, refreshPaymentMethods: async () => {}, navigationOrigin: null
    };

    const render = () => {
        if (loading) return <SplashScreen />;
        switch (currentScreen) {
            case Screen.Login: return <LoginScreen />;
            case Screen.SignUp: return <SignUpScreen />;
            case Screen.SignUpSuccess: return <SignUpSuccessScreen />;
            case Screen.ForgotPassword: return <ForgotPasswordScreen />;
            case Screen.ResetPassword: return <ResetPasswordScreen />;
            case Screen.MainMap: return <MainMapScreen />;
            case Screen.SearchDestination: return <SearchDestinationScreen />;
            case Screen.Profile: return <ProfileScreen />;
            case Screen.History: return <HistoryScreen />;
            case Screen.Payments: return <PaymentsScreen />;
            case Screen.Support: return <SupportScreen />;
            case Screen.Settings: return <SettingsScreen />;
            case Screen.AddCard: return <AddCardScreen />;
            case Screen.ScheduledRides: return <ScheduledRidesScreen />;
            case Screen.Chat: return <ChatScreen />;
            default: return <LoginScreen />;
        }
    };

    return <AppContext.Provider value={value}><div className="w-full h-full font-sans">{render()}</div></AppContext.Provider>;
};

export default App;
