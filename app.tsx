
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

type RideState = {
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
    paymentMethodType: 'money' | 'pix' | 'card';
    paymentMethodId: number | null;
    paymentMethodLabel: string;
};

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
    paymentMethodType: 'money',
    paymentMethodId: null,
    paymentMethodLabel: 'Dinheiro',
};

interface AppContextType {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
    signOut: () => void;
    navigate: (screen: Screen) => void;
    rideState: RideState;
    setRideState: React.Dispatch<React.SetStateAction<RideState>>;
}

const AppContext = createContext<AppContextType | null>(null);

const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error('useAppContext must be used within an AppProvider');
    return context;
};

// --- HELPER FUNCTIONS ---
const getInitials = (name: string | null | undefined): string => {
    if (!name) return '';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
};

// --- ICONS & UI COMPONENTS ---
const Logo: React.FC<{ className?: string }> = ({ className }) => <h1 className={`text-5xl font-bold tracking-tighter text-white ${className}`}>Move</h1>;
const MenuIcon: React.FC = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>;
const CheckCircleIcon: React.FC = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-green-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;

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
            <div className="mb-10 text-center"><h2 className="text-3xl font-bold text-slate-800">Entrar</h2><p className="text-gray-500 mt-2">Use seu e-mail cadastrado</p></div>
            {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-center">{error}</p>}
            <form onSubmit={handleLogin} className="space-y-4"><Input placeholder="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} required /><Input placeholder="Senha" type="password" value={password} onChange={e => setPassword(e.target.value)} required /><Button type="submit" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</Button></form>
            <a onClick={() => navigate(Screen.ForgotPassword)} className="text-sm text-slate-600 hover:underline text-center block mt-4 cursor-pointer">Esqueceu sua senha?</a>
            <p className="text-center text-sm text-gray-500 mt-8">Ainda não tem conta? <a onClick={() => navigate(Screen.SignUp)} className="font-semibold text-slate-600 hover:underline cursor-pointer">Cadastre-se</a></p>
        </div>
    );
};

const SignUpScreen: React.FC = () => {
    const { navigate } = useAppContext();
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault(); setLoading(true); setError(null);
        if (password !== confirmPassword) { setError("As senhas não coincidem."); setLoading(false); return; }
        try { 
            const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName, phone: phone } } }); 
            if (error) throw error; navigate(Screen.SignUpSuccess); 
        } catch (err: any) { setError(err.message || "Erro ao cadastrar."); } finally { setLoading(false); }
    };
    return (
        <div className="w-full h-full bg-white flex flex-col justify-center p-8 animate-fade-in">
            <div className="mb-8 text-center"><h2 className="text-3xl font-bold text-slate-800">Criar Conta</h2><p className="text-gray-500 mt-2">É rápido e fácil!</p></div>
            {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-center">{error}</p>}
            <form onSubmit={handleSignUp} className="space-y-4">
                <Input placeholder="Nome completo" value={fullName} onChange={e => setFullName(e.target.value)} required />
                <Input placeholder="Telefone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} required />
                <Input placeholder="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                <Input placeholder="Senha" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                <Input placeholder="Confirmar Senha" type="password" value={confirmPassword} onChange={e => setPassword(e.target.value)} required />
                <Button type="submit" disabled={loading}>{loading ? 'Cadastrando...' : 'Cadastrar'}</Button>
            </form>
            <p className="text-center text-sm text-gray-500 mt-8">Já tem conta? <a onClick={() => navigate(Screen.Login)} className="font-semibold text-slate-600 hover:underline cursor-pointer">Entrar</a></p>
        </div>
    );
};

const SignUpSuccessScreen: React.FC = () => {
    const { navigate } = useAppContext();
    return (
        <div className="w-full h-full bg-white flex flex-col items-center justify-center p-8 text-center animate-fade-in">
            <CheckCircleIcon /><h2 className="text-3xl font-bold text-slate-800 mt-6">Sucesso!</h2><p className="text-gray-600 mt-2 max-w-sm">Verifique seu e-mail para confirmar a conta.</p>
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
            <form onSubmit={handleReset} className="space-y-4"><Input placeholder="Nova senha" type="password" value={password} onChange={e => setPassword(e.target.value)} required /><Input placeholder="Confirmar nova senha" type="password" value={confirmPassword} onChange={e => setPassword(e.target.value)} required /><Button type="submit" disabled={loading || !!message}>{loading ? 'Salvando...' : 'Salvar Nova Senha'}</Button></form>
        </div>
    );
};

const MainMapScreen: React.FC = () => {
    const { navigate, rideState, setRideState } = useAppContext();
    const mapRef = useRef<HTMLDivElement>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isLocationReady, setIsLocationReady] = useState(false);
    const mapInstance = useRef<any>(null);
    const userMarker = useRef<any>(null);
    
    // Tracking Drivers State
    const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
    const driverMarkers = useRef<{ [key: string]: any }>({});

    // Fetch and Subscribe to Drivers
    const fetchDrivers = async () => {
        const { data, error } = await supabase
            .from('drivers')
            .select('*')
            .eq('is_active', true)
            .eq('status', 'online');
        
        if (!error && data) {
            setAvailableDrivers(data);
        }
    };

    const initMap = (pos: { lat: number; lng: number }) => {
        if (!mapRef.current || !window.google) return;

        mapInstance.current = new window.google.maps.Map(mapRef.current, {
            center: pos, 
            zoom: 15,
            disableDefaultUI: true,
            styles: [
                { featureType: 'poi', stylers: [{ visibility: 'off' }] },
                { featureType: 'transit', stylers: [{ visibility: 'off' }] }
            ]
        });

        userMarker.current = new window.google.maps.Marker({
            position: pos,
            map: mapInstance.current,
            icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#4285F4',
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: 'white'
            }
        });

        setIsLocationReady(true);
        fetchDrivers();
    };

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
                    setRideState(prev => ({ ...prev, originLat: pos.lat, originLng: pos.lng }));
                    
                    if (window.google) {
                        initMap(pos);
                    }
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    alert("Por favor, ative seu GPS para usar o Move.");
                    const fallbackPos = { lat: -23.5505, lng: -46.6333 };
                    if (window.google) initMap(fallbackPos);
                },
                { enableHighAccuracy: true, timeout: 5000 }
            );
        }

        const channel = supabase
            .channel('available_drivers')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => {
                fetchDrivers();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    useEffect(() => {
        if (!rideState.rideId) return;

        const rideChannel = supabase
            .channel(`ride_status_${rideState.rideId}`)
            .on('postgres_changes', 
                { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${rideState.rideId}` }, 
                (payload) => {
                    const updated = payload.new;
                    if (updated.status === 'ACCEPTED') {
                        setRideState(prev => ({ 
                            ...prev, 
                            stage: 'driver_en_route', 
                            driverId: updated.driver_id 
                        }));
                    } else if (updated.status === 'IN_PROGRESS') {
                        setRideState(prev => ({ ...prev, stage: 'in_progress' }));
                    } else if (updated.status === 'COMPLETED') {
                        setRideState(prev => ({ ...prev, stage: 'rating' }));
                    } else if (updated.status === 'CANCELLED') {
                        setRideState(initialRideState);
                        alert("Sua corrida foi cancelada pelo motorista.");
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(rideChannel);
        };
    }, [rideState.rideId]);

    useEffect(() => {
        if (!mapInstance.current || !window.google) return;

        availableDrivers.forEach(driver => {
            const pos = { lat: driver.current_latitude, lng: driver.current_longitude };
            if (driverMarkers.current[driver.id]) {
                driverMarkers.current[driver.id].setPosition(pos);
            } else {
                driverMarkers.current[driver.id] = new window.google.maps.Marker({
                    position: pos,
                    map: mapInstance.current,
                    title: `${driver.vehicle_model} (${driver.vehicle_color})`,
                    icon: {
                        url: 'https://cdn-icons-png.flaticon.com/512/1048/1048313.png',
                        scaledSize: new window.google.maps.Size(32, 32),
                        origin: new window.google.maps.Point(0, 0),
                        anchor: new window.google.maps.Point(16, 16)
                    }
                });
            }
        });

        Object.keys(driverMarkers.current).forEach(id => {
            if (!availableDrivers.find(d => d.id === id)) {
                driverMarkers.current[id].setMap(null);
                delete driverMarkers.current[id];
            }
        });
    }, [availableDrivers]);

    return (
        <div className="w-full h-full relative overflow-hidden bg-gray-100">
            <div ref={mapRef} className={`w-full h-full transition-opacity duration-700 ${isLocationReady ? 'opacity-100' : 'opacity-0'}`} />
            
            {!isLocationReady && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-50">
                    <div className="w-12 h-12 border-4 border-slate-800 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-slate-600 font-medium animate-pulse">Confirmando sua localização...</p>
                </div>
            )}

            <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
            
            <div className={`absolute top-5 left-5 right-5 bg-white rounded-lg shadow-lg flex items-center p-3 z-10 space-x-2 transition-all duration-500 ${isLocationReady ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}`}>
                <button onClick={() => setIsMenuOpen(true)} className="p-2 rounded-full hover:bg-gray-100"><MenuIcon /></button>
                <div className="flex-grow cursor-pointer p-2" onClick={() => navigate(Screen.SearchDestination)}><span className="text-lg text-gray-500">Para onde vamos?</span></div>
            </div>
            
            {rideState.stage !== 'none' && <RideRequestSheet />}
        </div>
    );
};

const SearchDestinationScreen: React.FC = () => {
    const { navigate, setRideState, user, rideState } = useAppContext();
    const [from, setFrom] = useState('Minha Localização');
    const [to, setTo] = useState('');
    const [loading, setLoading] = useState(false);

    const handleConfirm = async () => {
        if (!to.trim()) return;
        if (!user) {
            alert("Sessão expirada. Faça login novamente.");
            return;
        }

        setLoading(true);

        let currentLat = rideState.originLat;
        let currentLng = rideState.originLng;

        if (!currentLat || !currentLng) {
            try {
                const position: any = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject);
                });
                currentLat = position.coords.latitude;
                currentLng = position.coords.longitude;
            } catch (err) {
                console.error("GPS Error during confirm", err);
                alert("Ative seu GPS para pedir uma corrida.");
                setLoading(false);
                return;
            }
        }

        setRideState(prev => ({ 
            ...prev, 
            stage: 'searching', 
            from, 
            to, 
            originLat: currentLat, 
            originLng: currentLng 
        }));
        navigate(Screen.MainMap);

        try {
            // CORREÇÃO: Nomes das colunas origin_latitude e origin_longitude para bater com o banco
            const { data, error } = await supabase
                .from('rides')
                .insert([
                    {
                        user_id: user.id,
                        from_location: from,
                        to_location: to,
                        origin_latitude: currentLat,
                        origin_longitude: currentLng,
                        estimated_price: 25.90,
                        payment_method: rideState.paymentMethodType,
                        status: 'REQUESTED'
                    }
                ])
                .select()
                .single();

            if (error) throw error;

            if (data) {
                setRideState(prev => ({ ...prev, rideId: data.id }));
                console.log("Corrida iniciada. ID:", data.id);
            }

        } catch (err: any) {
            console.error("Erro ao solicitar corrida:", err);
            alert("Não foi possível processar seu pedido.");
            setRideState(initialRideState);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full h-full bg-white flex flex-col">
            <header className="p-4 flex items-center border-b"><button onClick={() => navigate(Screen.MainMap)} className="p-2 mr-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button><h2 className="text-xl font-semibold">Definir Rota</h2></header>
            <main className="p-4 space-y-4"><Input placeholder="Local de partida" value={from} onChange={e => setFrom(e.target.value)} /><Input placeholder="Para onde?" value={to} onChange={e => setTo(e.target.value)} autoFocus /></main>
            <footer className="p-4"><Button onClick={handleConfirm} disabled={!to.trim() || loading}>{loading ? 'Solicitando...' : 'Confirmar Rota'}</Button></footer>
        </div>
    );
};

const RideRequestSheet = () => {
    const { rideState, setRideState } = useAppContext();
    const isSearching = rideState.stage === 'searching';
    const isAccepted = rideState.stage === 'driver_en_route';

    return (
        <div className="absolute bottom-0 left-0 right-0 bg-white p-6 rounded-t-2xl shadow-2xl z-20 space-y-4 animate-slide-in-up">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-xl font-bold">
                        {isAccepted ? 'Motorista a caminho' : 'Procurando Motorista'}
                    </h2>
                    <p className="text-sm text-gray-500">Pagamento: <span className="font-bold text-slate-700">{rideState.paymentMethodLabel}</span></p>
                </div>
                <div className="text-right">
                    <p className="text-lg font-bold text-slate-800">R$ 25,90</p>
                </div>
            </div>
            
            <div className={`flex items-center space-x-3 p-4 rounded-lg transition-colors ${isAccepted ? 'bg-green-50' : 'bg-gray-50'}`}>
                {isAccepted ? (
                    <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center text-white font-bold text-xl">M</div>
                ) : (
                    <div className="w-10 h-10 bg-slate-200 rounded-full animate-pulse" />
                )}
                
                <div className="flex-grow space-y-2">
                    {isAccepted ? (
                        <>
                            <div className="font-bold text-slate-800">Seu motorista chegará em instantes</div>
                            <div className="text-xs text-gray-500">Honda Civic • ABC-1234</div>
                        </>
                    ) : (
                        <>
                            <div className="h-4 bg-slate-200 rounded w-1/2 animate-pulse" />
                            <div className="h-3 bg-slate-200 rounded w-3/4 animate-pulse" />
                        </>
                    )}
                </div>
            </div>
            
            <Button variant="danger" onClick={() => setRideState(initialRideState)}>Cancelar</Button>
        </div>
    );
};

const SideMenu: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const { profile, navigate, signOut } = useAppContext();
    const items = [ 
        {l: 'Perfil', s: Screen.Profile, i: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'}, 
        {l: 'Histórico', s: Screen.History, i: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'}, 
        {l: 'Pagamentos', s: Screen.Payments, i: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z'}, 
        {l: 'Agendadas', s: Screen.ScheduledRides, i: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'}, 
        {l: 'Configurações', s: Screen.Settings, i: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'} 
    ];
    return (
        <div className={`absolute inset-0 z-50 pointer-events-none transition-all duration-300 ${isOpen ? 'visible' : 'invisible'}`}>
            <div className={`absolute inset-0 bg-black bg-opacity-40 transition-opacity pointer-events-auto ${isOpen ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
            <div className={`absolute left-0 top-0 bottom-0 w-[280px] bg-white transition-transform pointer-events-auto shadow-2xl flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="bg-slate-800 p-8 text-white flex items-center space-x-4">
                    <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center text-xl font-bold shadow-lg">{getInitials(profile?.full_name)}</div>
                    <div><p className="text-lg font-bold leading-tight">{profile?.full_name || 'Usuário'}</p><p className="text-sm text-slate-300">Nível Bronze</p></div>
                </div>
                <nav className="flex-grow p-4 space-y-1">
                    {items.map(i => (
                        <a key={i.l} className="flex items-center space-x-4 p-3 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors text-slate-700" onClick={() => { navigate(i.s); onClose(); }}>
                            <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={i.i} /></svg>
                            <span className="font-medium">{i.l}</span>
                        </a>
                    ))}
                </nav>
                <div className="p-4 border-t bg-gray-50">
                    <a onClick={signOut} className="flex items-center space-x-4 p-3 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer font-semibold transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                        <span>Sair</span>
                    </a>
                </div>
            </div>
        </div>
    );
};

const ProfileScreen: React.FC = () => <ScreenWrapper title="Perfil" onBack={() => useAppContext().navigate(Screen.MainMap)}><div className="flex flex-col items-center space-y-6"><div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center text-3xl font-bold">{getInitials(useAppContext().profile?.full_name)}</div><div className="w-full space-y-4"><Input readOnly value={useAppContext().profile?.full_name || ''} label="Nome" /><Input readOnly value={useAppContext().user?.email || ''} label="Email" /></div></div></ScreenWrapper>;
const HistoryScreen: React.FC = () => <ScreenWrapper title="Histórico" onBack={() => useAppContext().navigate(Screen.MainMap)}><div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100"><div className="flex justify-between font-bold mb-2"><span>12 Out, 14:30</span><span>R$ 24,90</span></div><div className="text-sm text-gray-500">De: Rua A, 123</div><div className="text-sm text-gray-500">Para: Shopping Center</div></div>)}</div></ScreenWrapper>;

const PaymentsScreen: React.FC = () => {
    const { user, navigate, rideState, setRideState } = useAppContext();
    const [methods, setMethods] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchMethods = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const { data, error } = await supabase.from('payment_methods').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            if (data) setMethods(data);
        } catch (e) { console.error("Erro ao buscar cartões:", e); } finally { setLoading(false); }
    };

    useEffect(() => { fetchMethods(); }, [user]);

    const selectMethod = (type: 'money' | 'pix' | 'card', id: number | null = null, label: string = '') => {
        setRideState(prev => ({ ...prev, paymentMethodType: type, paymentMethodId: id, paymentMethodLabel: label }));
    };

    const removeMethod = async (id: number) => {
        try {
            const { error } = await supabase.from('payment_methods').delete().eq('id', id);
            if (error) throw error;
            setMethods(prev => prev.filter(m => m.id !== id));
            if (rideState.paymentMethodId === id) selectMethod('money', null, 'Dinheiro');
        } catch (e) { alert("Erro ao remover cartão."); }
    };

    return (
        <ScreenWrapper title="Pagamentos" onBack={() => navigate(Screen.MainMap)}>
            <div className="space-y-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Opções Fixas</p>
                <div onClick={() => selectMethod('money', null, 'Dinheiro')} className={`p-4 rounded-xl shadow-sm border cursor-pointer transition-all flex items-center space-x-4 ${rideState.paymentMethodType === 'money' ? 'bg-slate-100 border-slate-300 ring-2 ring-slate-400/20' : 'bg-white border-gray-100'}`}>
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                    <div className="flex-grow"><p className="font-bold text-slate-800">Dinheiro</p><p className="text-xs text-gray-500">Pague direto ao motorista</p></div>
                    {rideState.paymentMethodType === 'money' && <div className="w-5 h-5 bg-slate-800 rounded-full flex items-center justify-center"><svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>}
                </div>
                <div onClick={() => selectMethod('pix', null, 'Pix')} className={`p-4 rounded-xl shadow-sm border cursor-pointer transition-all flex items-center space-x-4 ${rideState.paymentMethodType === 'pix' ? 'bg-slate-100 border-slate-300 ring-2 ring-slate-400/20' : 'bg-white border-gray-100'}`}>
                    <div className="w-10 h-10 bg-cyan-100 rounded-full flex items-center justify-center text-cyan-600 font-bold text-xs">PIX</div>
                    <div className="flex-grow"><p className="font-bold text-slate-800">Pix</p><p className="text-xs text-gray-500">Pagamento instantâneo</p></div>
                    {rideState.paymentMethodType === 'pix' && <div className="w-5 h-5 bg-slate-800 rounded-full flex items-center justify-center"><svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>}
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1 mt-6">Seus Cartões</p>
                {loading ? (
                    <div className="flex justify-center p-10"><div className="w-6 h-6 border-2 border-slate-800 border-t-transparent rounded-full animate-spin"></div></div>
                ) : methods.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-xl border border-dashed border-gray-300 text-gray-400 text-sm">Nenhum cartão cadastrado.</div>
                ) : (
                    methods.map(m => (
                        <div key={m.id} onClick={() => selectMethod('card', m.id, `${m.brand} •••• ${m.last4}`)} className={`p-4 rounded-xl shadow-sm border cursor-pointer transition-all flex justify-between items-center group ${rideState.paymentMethodId === m.id && rideState.paymentMethodType === 'card' ? 'bg-slate-100 border-slate-300 ring-2 ring-slate-400/20' : 'bg-white border-gray-100'}`}>
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-6 bg-slate-200 rounded flex items-center justify-center text-[10px] font-bold text-slate-600 uppercase">{m.brand}</div>
                                <div><p className="font-semibold text-slate-800">•••• {m.last4}</p><p className="text-[10px] text-gray-400 uppercase">{m.type === 'credit_card' ? 'Crédito' : 'Débito'}</p></div>
                            </div>
                            <div className="flex items-center space-x-2">
                                {rideState.paymentMethodId === m.id && rideState.paymentMethodType === 'card' && <div className="w-5 h-5 bg-slate-800 rounded-full flex items-center justify-center mr-2"><svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg></div>}
                                <button onClick={(e) => { e.stopPropagation(); removeMethod(m.id); }} className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                            </div>
                        </div>
                    ))
                )}
                <Button variant="secondary" onClick={() => navigate(Screen.AddCard)} className="mt-4">+ Adicionar Novo Cartão</Button>
            </div>
        </ScreenWrapper>
    );
};

const AddCardScreen: React.FC = () => {
    const { user, navigate, setRideState } = useAppContext();
    const [loading, setLoading] = useState(false);
    const [last4, setLast4] = useState('');
    const [brand, setBrand] = useState('Visa');

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault(); if (!user || last4.length !== 4) return;
        setLoading(true);
        try {
            const { data, error } = await supabase.from('payment_methods').insert({ user_id: user.id, last4, brand, type: 'credit_card', is_selected: true }).select().single();
            if (error) throw error;
            if (data) setRideState(prev => ({ ...prev, paymentMethodType: 'card', paymentMethodId: data.id, paymentMethodLabel: `${data.brand} •••• ${data.last4}` }));
            navigate(Screen.Payments);
        } catch (e) { alert("Erro ao salvar cartão."); } finally { setLoading(false); }
    };

    return (
        <ScreenWrapper title="Adicionar Cartão" onBack={() => navigate(Screen.Payments)}>
            <form onSubmit={handleAdd} className="space-y-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Dados do Cartão</p>
                    <Input placeholder="Número do Cartão (Simulado)" type="text" maxLength={16} required />
                    <div className="flex space-x-4"><Input placeholder="MM/AA" className="flex-1" maxLength={5} required /><Input placeholder="CVC" className="flex-1" maxLength={3} required /></div>
                    <hr className="my-2" /><p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Exibição no App</p>
                    <Input placeholder="4 últimos dígitos" value={last4} onChange={e => setLast4(e.target.value.replace(/\D/g,''))} maxLength={4} required />
                    <select className="w-full px-4 py-3 bg-gray-100 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-slate-500" value={brand} onChange={e => setBrand(e.target.value)}>
                        <option value="Visa">Visa</option><option value="Mastercard">Mastercard</option><option value="Elo">Elo</option><option value="American Express">American Express</option>
                    </select>
                </div>
                <Button type="submit" disabled={loading || last4.length !== 4}>{loading ? 'Processando...' : 'Cadastrar e Selecionar'}</Button>
            </form>
        </ScreenWrapper>
    );
};

const SettingsScreen: React.FC = () => <ScreenWrapper title="Configurações" onBack={() => useAppContext().navigate(Screen.MainMap)}><div className="space-y-2"><div className="p-4 bg-white rounded-lg shadow-sm border border-gray-100 flex justify-between items-center"><span>Notificações</span><div className="w-10 h-5 bg-slate-800 rounded-full" /></div></div></ScreenWrapper>;
const ScheduledRidesScreen: React.FC = () => <ScreenWrapper title="Agendadas" onBack={() => useAppContext().navigate(Screen.MainMap)}><p className="text-center text-gray-500 mt-10">Nenhuma viagem agendada.</p></ScreenWrapper>;

const App: React.FC = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.SplashScreen);
    const [loading, setLoading] = useState(true);
    const [rideState, setRideState] = useState<RideState>(initialRideState);
    const recoveryInProgress = useRef(false);

    const refreshProfile = async (u: User) => {
        try {
            const { data, error } = await supabase.from('profiles').select('*').eq('id', u.id).single();
            if (error) throw error; if (data) setProfile(data as Profile);
        } catch (e) { console.warn("Could not fetch profile", e); }
    };

    useEffect(() => {
        const safetyTimeout = setTimeout(() => { if (loading) { setLoading(false); if (!session) setCurrentScreen(Screen.Login); } }, 6000);
        const isRec = window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery');
        if (isRec) { recoveryInProgress.current = true; setTimeout(() => { if (recoveryInProgress.current && loading) { setLoading(false); setCurrentScreen(Screen.Login); } }, 8000); }
        const handleInit = async (s: Session) => {
            try {
                if (s?.user) { setUser(s.user); refreshProfile(s.user); if (!recoveryInProgress.current) { setCurrentScreen(Screen.MainMap); setLoading(false); clearTimeout(safetyTimeout); } } 
                else { if (!recoveryInProgress.current) { setCurrentScreen(Screen.Login); setLoading(false); clearTimeout(safetyTimeout); } }
            } catch (e) { setLoading(false); setCurrentScreen(Screen.Login); clearTimeout(safetyTimeout); }
        };
        supabase.auth.getSession().then(({ data: { session: currentSession } }) => { setSession(currentSession); handleInit(currentSession); });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
            if (event === 'PASSWORD_RECOVERY') { recoveryInProgress.current = true; setSession(s); setUser(s?.user); setCurrentScreen(Screen.ResetPassword); setLoading(false); clearTimeout(safetyTimeout); } 
            else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') { if (!recoveryInProgress.current) { setSession(s); handleInit(s); } } 
            else if (event === 'SIGNED_OUT') { recoveryInProgress.current = false; setSession(null); setUser(null); setCurrentScreen(Screen.Login); setLoading(false); clearTimeout(safetyTimeout); }
        });
        return () => { subscription.unsubscribe(); clearTimeout(safetyTimeout); };
    }, []);

    const value: AppContextType = { session, user, profile, setProfile, signOut: () => supabase.auth.signOut(), navigate: setCurrentScreen, rideState, setRideState };
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
            case Screen.AddCard: return <AddCardScreen />;
            case Screen.Settings: return <SettingsScreen />;
            case Screen.ScheduledRides: return <ScheduledRidesScreen />;
            default: return <LoginScreen />;
        }
    };
    return <AppContext.Provider value={value}><div className="w-full h-full phone-screen overflow-hidden">{render()}</div></AppContext.Provider>;
};

export default App;
