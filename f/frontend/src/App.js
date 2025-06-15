import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signOut, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, setLogLevel } from 'firebase/firestore';

// --- Firebase Configuration (Defined outside the component) ---
// IMPORTANT: For local development, load these from .env.local
// In the Canvas environment, __firebase_config is provided.
const firebaseConfig = typeof __firebase_config !== 'undefined'
    ? JSON.parse(__firebase_config)
    : {
        apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
        authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
        storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.REACT_APP_FIREBASE_APP_ID
    };

// --- Custom Modal Component for Notifications and SOS ---
// This component provides a consistent and user-friendly way to display messages
// and replaces browser-native alert/confirm calls.
const Modal = ({ show, message, type, onClose, children }) => {
    if (!show) return null;

    const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
    const textColor = 'text-white';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center relative">
                <div className={`absolute top-0 left-0 right-0 h-2 ${bgColor} rounded-t-lg`}></div>
                <h3 className={`text-xl font-bold mb-4 ${type === 'error' ? 'text-red-700' : type === 'success' ? 'text-green-700' : 'text-blue-700'}`}>
                    {type === 'success' ? 'Success!' : type === 'error' ? 'Error!' : 'Notification'}
                </h3>
                <p className="mb-6 text-gray-700">{message}</p>
                {children} {/* For SOS modal content */}
                <button
                    onClick={onClose}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full shadow-md transition-all duration-200 ease-in-out"
                >
                    Close
                </button>
            </div>
        </div>
    );
};

// --- AI Chatbot Component ---
// This component handles the conversational AI interaction.
const AiChatbot = ({ biodata, isVisible, onClose }) => {
    const [messages, setMessages] = useState([
        { role: 'bot', text: "Hello! I'm the Health Yaar AI assistant. How can I help you today? You can ask me general health questions." }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    // Scrolls the chat messages to the bottom whenever new messages are added.
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // Handles sending user messages to the AI via the backend.
    const handleSendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        const currentInput = input;
        setInput('');
        setIsLoading(true);

        try {
            // --- API call to your backend ---
            // The backend will then securely call the Gemini API.
            const response = await fetch('http://localhost:3001/api/chat', { // Adjust port if your backend runs on a different one
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userInput: currentInput,
                    chatHistory: messages.map(msg => ({ // Send previous messages for context
                        role: msg.role === 'bot' ? 'model' : 'user',
                        parts: [{ text: msg.text }]
                    }))
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Server responded with status: ${response.status}, Error: ${errorData.message || 'Unknown error'}`);
            }

            const result = await response.json();
            setMessages(prev => [...prev, { role: 'bot', text: result.response }]);
        } catch (error) {
            console.error("Chatbot backend fetch error:", error);
            setMessages(prev => [...prev, { role: 'bot', text: "Sorry, I encountered an error connecting to the AI. Please try again." }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-20 right-5 w-full max-w-md h-[calc(100vh-10rem)] bg-white rounded-xl shadow-2xl flex flex-col z-30 transition-all duration-300 transform md:scale-100 scale-95">
            <div className="p-4 bg-blue-600 text-white rounded-t-xl flex justify-between items-center shadow-md">
                <h3 className="font-bold text-lg">AI Health Assistant</h3>
                <button onClick={onClose} className="text-2xl leading-none font-semibold hover:text-gray-200 transition-colors">&times;</button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto bg-gray-50 border-b border-gray-100">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-3`}>
                        <div className={`py-2 px-4 rounded-2xl max-w-[80%] break-words ${msg.role === 'user' ? 'bg-blue-500 text-white rounded-br-none' : 'bg-gray-200 text-gray-800 rounded-bl-none'}`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start mb-3">
                        <div className="py-2 px-4 rounded-2xl bg-gray-200 text-gray-800 animate-pulse">
                            <span className="text-sm">Bot is typing...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-4 border-t border-gray-200 bg-white">
                <div className="flex">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        className="flex-1 p-3 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow text-gray-800"
                        placeholder="Ask a health question..."
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={isLoading}
                        className="bg-blue-600 text-white px-5 rounded-r-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Main App Component ---
export default function App() {
    // --- State Management ---
    const [auth, setAuth] = useState(null);
    const [db, setDb] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [notification, setNotification] = useState({ show: false, message: '', type: '' });
    const [isSosModalOpen, setIsSosModalOpen] = useState(false);
    const [isChatbotVisible, setIsChatbotVisible] = useState(false);
    const [healthSummary, setHealthSummary] = useState('');
    const [isSummaryLoading, setIsSummaryLoading] = useState(false);
    const [reportAnalysis, setReportAnalysis] = useState('');
    const [isReportLoading, setIsReportLoading] = useState(false);
    const [reportImage, setReportImage] = useState(null);
    const [reportImagePreview, setReportImagePreview] = useState(null);

    const [formData, setFormData] = useState({
        fullName: '', dob: '', gender: 'Male', phone: '', location: '',
        height: '', weight: '', bloodGroup: '', allergies: '', chronicDiseases: '', pastMedicalHistory: '',
        smokingStatus: 'Never', alcoholConsumption: '', dietaryHabits: '', exercise: '', sleepHours: '', stressLevel: 'Low',
    });

    // --- Firebase Configuration ---
    // In Canvas, __app_id is provided. For local, you might use a .env variable.
    const appId = typeof __app_id !== 'undefined' ? __app_id : process.env.REACT_APP_APP_ID || 'default-app-id-local';

    // --- Helpers ---
    const showNotification = useCallback((message, type = 'success') => {
        setNotification({ show: true, message, type });
        setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
    }, []);

    const fileToBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });

    // --- Firebase Initialization and Auth ---
    useEffect(() => {
        try {
            const app = initializeApp(firebaseConfig);
            const authInstance = getAuth(app);
            const dbInstance = getFirestore(app);
            setAuth(authInstance);
            setDb(dbInstance);

            const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    // In Canvas, __initial_auth_token is provided. For local, you might implement a login or test user.
                    const initialToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
                    if (initialToken) {
                        await signInWithCustomToken(authInstance, initialToken);
                    } else {
                        await signInAnonymously(authInstance);
                    }
                }
                setIsAuthReady(true);
            });
            return () => unsubscribe();
        } catch (error) {
            console.error("Firebase initialization failed:", error);
            showNotification('Could not connect to health services.', 'error');
        }
    }, [showNotification]);

    // --- Data Fetching from Firestore ---
    const fetchUserData = useCallback(async () => {
        if (!isAuthReady || !db || !userId) {
            return;
        }
        const userDocRef = doc(db, 'artifacts', appId, 'users', userId, 'biodata', 'profile');
        try {
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                setFormData(prevData => ({ ...prevData, ...docSnap.data() }));
                showNotification('Profile loaded.', 'success');
            } else {
                showNotification('No existing profile found. Please fill out your details.', 'info');
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
            showNotification('Failed to load your profile.', 'error');
        }
    }, [db, userId, isAuthReady, appId, showNotification]);

    useEffect(() => {
        if (isAuthReady) {
            fetchUserData();
        }
    }, [isAuthReady, fetchUserData]);

    // --- Event Handlers ---
    const handleInputChange = useCallback((e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleFormSubmit = useCallback(async (e) => {
        e.preventDefault();
        if (!db || !userId) {
            showNotification('Cannot save. Not connected to services.', 'error');
            return;
        }
        const userDocRef = doc(db, 'artifacts', appId, 'users', userId, 'biodata', 'profile');
        try {
            await setDoc(userDocRef, formData, { merge: true });
            showNotification('Profile saved successfully!', 'success');
        } catch (error) {
            console.error("Error saving profile:", error);
            showNotification('Failed to save profile. Please try again.', 'error');
        }
    }, [db, userId, appId, formData, showNotification]);

    const handleSosClick = useCallback(() => {
        setIsSosModalOpen(true);
    }, []);

    const handleLogout = useCallback(async () => {
        if (!auth) return;
        try {
            await signOut(auth);
            setUserId(null);
            setFormData({ fullName: '', dob: '', gender: 'Male', phone: '', location: '', height: '', weight: '', bloodGroup: '', allergies: '', chronicDiseases: '', pastMedicalHistory: '', smokingStatus: 'Never', alcoholConsumption: '', dietaryHabits: '', exercise: '', sleepHours: '', stressLevel: 'Low' });
            showNotification('You have been logged out successfully.', 'success');
        } catch (error) {
            console.error("Logout failed:", error);
            showNotification('Logout failed. Please try again.', 'error');
        }
    }, [auth, showNotification]);

    // Generates a health summary via the backend.
    const handleGenerateSummary = useCallback(async () => {
        if (!formData.fullName && !formData.height && !formData.weight) {
            showNotification('Please provide your full name, height, and weight to generate a summary.', 'error');
            return;
        }
        setIsSummaryLoading(true);
        setHealthSummary('');

        try {
            const response = await fetch('http://localhost:3001/api/generateHealthSummary', { // Adjust port
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ formData })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Server responded with status: ${response.status}, Error: ${errorData.message || 'Unknown error'}`);
            }

            const result = await response.json();
            setHealthSummary(result.summaryHtml);
        } catch (error) {
            console.error("Error generating summary via backend:", error);
            setHealthSummary('<p class="text-red-600">An error occurred while generating the summary. Please check your connection and try again.</p>');
        } finally {
            setIsSummaryLoading(false);
        }
    }, [formData, showNotification]);

    // Analyzes a medical report image via the backend.
    const handleAnalyzeReport = useCallback(async () => {
        if (!reportImage) {
            showNotification('Please upload a medical report image first to analyze.', 'error');
            return;
        }
        setIsReportLoading(true);
        setReportAnalysis('');

        try {
            const base64ImageData = await fileToBase64(reportImage);

            const response = await fetch('http://localhost:3001/api/analyzeReport', { // Adjust port
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64ImageData, mimeType: reportImage.type })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Server responded with status: ${response.status}, Error: ${errorData.message || 'Unknown error'}`);
            }

            const result = await response.json();
            setReportAnalysis(result.analysisHtml);
        } catch (error) {
            console.error("Error analyzing report via backend:", error);
            setReportAnalysis('<p class="text-red-600">An error occurred during analysis. Please check your connection and try again.</p>');
        } finally {
            setIsReportLoading(false);
        }
    }, [reportImage, showNotification]);

    const handleReportFileChange = useCallback((e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            setReportImage(file);
            setReportImagePreview(URL.createObjectURL(file));
        } else {
            showNotification('Please upload a valid image file (e.g., PNG, JPG).', 'error');
            setReportImage(null);
            setReportImagePreview(null);
        }
    }, [showNotification]);

    // Tailwind CSS classes for consistent styling
    const inputClasses = "w-full p-3 bg-gray-50 rounded-lg mt-1 border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow";
    const labelClasses = "block text-gray-700 font-semibold mb-1";
    const buttonClasses = "bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105";
    const secondaryButtonClasses = "bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-6 rounded-full shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105";

    return (
        <div className="min-h-screen bg-slate-50 text-gray-800 flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* Notification Modal */}
            <Modal
                show={notification.show}
                message={notification.message}
                type={notification.type}
                onClose={() => setNotification({ show: false, message: '', type: '' })}
            />

            {/* SOS Modal */}
            <Modal
                show={isSosModalOpen}
                onClose={() => setIsSosModalOpen(false)}
                type="error"
                message="This is a placeholder for your SOS feature. In a real application, this would trigger an emergency protocol."
            >
                <div className="mb-6 text-gray-700">
                    <ul className="list-disc list-inside mt-2 text-left space-y-1">
                        <li>Calling emergency services</li>
                        <li>Notifying emergency contacts</li>
                        <li>Sharing your location data</li>
                    </ul>
                    <p className="mt-4 font-semibold text-sm">Please ensure you set up emergency contacts in your profile settings for a real SOS functionality.</p>
                </div>
            </Modal>


            {/* Header */}
            <header className="bg-white shadow-md fixed w-full z-20 top-0">
                <div className="container mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-center">
                    <h1 className="text-3xl font-extrabold text-blue-600 mb-2 sm:mb-0">Health <span className="text-green-500">Yaar</span></h1>
                    <nav className="flex flex-wrap justify-center sm:space-x-8 space-x-4 items-center">
                        <a href="#features" className="text-gray-600 hover:text-blue-600 font-medium py-1">Features</a>
                        <a href="#biodata-form" className="text-gray-600 hover:text-blue-600 font-medium py-1">Profile</a>
                        <a href="#report-analysis" className="text-gray-600 hover:text-blue-600 font-medium py-1">Analysis</a>
                        {isAuthReady && userId && (
                            <button onClick={handleLogout} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-full shadow-lg transition transform hover:scale-105 text-sm">
                                Logout ({userId.substring(0, 5)}...)
                            </button>
                        )}
                        <button onClick={handleSosClick} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-full shadow-lg transition transform hover:scale-105 text-sm">
                            SOS
                        </button>
                    </nav>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 container mx-auto px-4 sm:px-6 py-8 mt-24">
                {/* Hero Section */}
                <section id="hero" className="text-center py-16 bg-gradient-to-r from-blue-50 to-indigo-100 rounded-xl shadow-inner mb-12">
                    <h2 className="text-5xl font-extrabold text-gray-900 mb-4 animate-fadeInDown">Your Personal <span className="text-blue-600">Health</span> Companion</h2>
                    <p className="text-xl text-gray-700 mb-8 max-w-2xl mx-auto animate-fadeInUp">Manage your health data, get AI insights, and connect with assistance, all in one place.</p>
                    <button onClick={() => setIsChatbotVisible(true)} className={buttonClasses}>
                        Talk to AI Health Assistant
                    </button>
                </section>

                {/* Features Section */}
                <section id="features" className="py-12 mb-12">
                    <h2 className="text-4xl font-bold text-center text-gray-900 mb-10">Key Features</h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        <div className="bg-white p-8 rounded-xl shadow-lg flex flex-col items-center text-center transform transition-transform hover:scale-105">
                            <i className="fas fa-user-md text-5xl text-blue-500 mb-4"></i>
                            <h3 className="text-2xl font-bold text-gray-900 mb-3">Personalized Biodata Management</h3>
                            <p className="text-gray-600">Securely store and update your essential health metrics and medical history.</p>
                        </div>
                        <div className="bg-white p-8 rounded-xl shadow-lg flex flex-col items-center text-center transform transition-transform hover:scale-105">
                            <i className="fas fa-robot text-5xl text-green-500 mb-4"></i>
                            <h3 className="text-2xl font-bold text-gray-900 mb-3">AI Health Summary & Chat</h3>
                            <p className="text-gray-600">Get AI-generated health summaries and ask health-related questions instantly.</p>
                        </div>
                        <div className="bg-white p-8 rounded-xl shadow-lg flex flex-col items-center text-center transform transition-transform hover:scale-105">
                            <i className="fas fa-file-medical-alt text-5xl text-purple-500 mb-4"></i>
                            <h3 className="text-2xl font-bold text-gray-900 mb-3">Medical Report Analysis</h3>
                            <p className="text-gray-600">Upload your medical reports for AI-powered analysis and insights.</p>
                        </div>
                    </div>
                </section>

                {/* Biodata Form Section */}
                <section id="biodata-form" className="bg-white p-8 rounded-xl shadow-lg mb-12">
                    <h2 className="text-4xl font-bold text-center text-gray-900 mb-8">Your Health Profile</h2>
                    <form onSubmit={handleFormSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Personal Information */}
                        <div className="md:col-span-2">
                            <h3 className="text-2xl font-semibold text-blue-700 mb-4 border-b pb-2">Personal Information</h3>
                        </div>
                        <div>
                            <label htmlFor="fullName" className={labelClasses}>Full Name</label>
                            <input type="text" id="fullName" name="fullName" value={formData.fullName} onChange={handleInputChange} className={inputClasses} placeholder="John Doe" required />
                        </div>
                        <div>
                            <label htmlFor="dob" className={labelClasses}>Date of Birth</label>
                            <input type="date" id="dob" name="dob" value={formData.dob} onChange={handleInputChange} className={inputClasses} />
                        </div>
                        <div>
                            <label htmlFor="gender" className={labelClasses}>Gender</label>
                            <select id="gender" name="gender" value={formData.gender} onChange={handleInputChange} className={inputClasses}>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="phone" className={labelClasses}>Phone Number</label>
                            <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleInputChange} className={inputClasses} placeholder="+1234567890" />
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="location" className={labelClasses}>Location</label>
                            <input type="text" id="location" name="location" value={formData.location} onChange={handleInputChange} className={inputClasses} placeholder="City, Country" />
                        </div>

                        {/* Health Metrics */}
                        <div className="md:col-span-2 mt-6">
                            <h3 className="text-2xl font-semibold text-blue-700 mb-4 border-b pb-2">Health Metrics</h3>
                        </div>
                        <div>
                            <label htmlFor="height" className={labelClasses}>Height (cm)</label>
                            <input type="number" id="height" name="height" value={formData.height} onChange={handleInputChange} className={inputClasses} placeholder="175" />
                        </div>
                        <div>
                            <label htmlFor="weight" className={labelClasses}>Weight (kg)</label>
                            <input type="number" id="weight" name="weight" value={formData.weight} onChange={handleInputChange} className={inputClasses} placeholder="70" />
                        </div>
                        <div>
                            <label htmlFor="bloodGroup" className={labelClasses}>Blood Group</label>
                            <input type="text" id="bloodGroup" name="bloodGroup" value={formData.bloodGroup} onChange={handleInputChange} className={inputClasses} placeholder="A+" />
                        </div>
                        <div>
                            <label htmlFor="allergies" className={labelClasses}>Allergies</label>
                            <input type="text" id="allergies" name="allergies" value={formData.allergies} onChange={handleInputChange} className={inputClasses} placeholder="Pollen, Penicillin" />
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="chronicDiseases" className={labelClasses}>Chronic Diseases</label>
                            <textarea id="chronicDiseases" name="chronicDiseases" value={formData.chronicDiseases} onChange={handleInputChange} className={`${inputClasses} min-h-[80px]`} placeholder="Diabetes, Hypertension"></textarea>
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="pastMedicalHistory" className={labelClasses}>Past Medical History</label>
                            <textarea id="pastMedicalHistory" name="pastMedicalHistory" value={formData.pastMedicalHistory} onChange={handleInputChange} className={`${inputClasses} min-h-[100px]`} placeholder="Appendectomy (2010), Fractured arm (2015)"></textarea>
                        </div>

                        {/* Lifestyle */}
                        <div className="md:col-span-2 mt-6">
                            <h3 className="text-2xl font-semibold text-blue-700 mb-4 border-b pb-2">Lifestyle & Habits</h3>
                        </div>
                        <div>
                            <label htmlFor="smokingStatus" className={labelClasses}>Smoking Status</label>
                            <select id="smokingStatus" name="smokingStatus" value={formData.smokingStatus} onChange={handleInputChange} className={inputClasses}>
                                <option value="Never">Never</option>
                                <option value="Former">Former Smoker</option>
                                <option value="Current">Current Smoker</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="alcoholConsumption" className={labelClasses}>Alcohol Consumption</label>
                            <input type="text" id="alcoholConsumption" name="alcoholConsumption" value={formData.alcoholConsumption} onChange={handleInputChange} className={inputClasses} placeholder="Rarely, Socially, Daily" />
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="dietaryHabits" className={labelClasses}>Dietary Habits</label>
                            <textarea id="dietaryHabits" name="dietaryHabits" value={formData.dietaryHabits} onChange={handleInputChange} className={`${inputClasses} min-h-[80px]`} placeholder="Vegetarian, Balanced, High-protein"></textarea>
                        </div>
                        <div>
                            <label htmlFor="exercise" className={labelClasses}>Exercise Routine</label>
                            <input type="text" id="exercise" name="exercise" value={formData.exercise} onChange={handleInputChange} className={inputClasses} placeholder="3 times a week, daily walk" />
                        </div>
                        <div>
                            <label htmlFor="sleepHours" className={labelClasses}>Average Sleep (hours)</label>
                            <input type="number" id="sleepHours" name="sleepHours" value={formData.sleepHours} onChange={handleInputChange} className={inputClasses} placeholder="7" min="0" max="24" />
                        </div>
                        <div className="md:col-span-2">
                            <label htmlFor="stressLevel" className={labelClasses}>Stress Level</label>
                            <select id="stressLevel" name="stressLevel" value={formData.stressLevel} onChange={handleInputChange} className={inputClasses}>
                                <option value="Low">Low</option>
                                <option value="Moderate">Moderate</option>
                                <option value="High">High</option>
                            </select>
                        </div>

                        <div className="md:col-span-2 flex justify-center mt-8 space-x-4">
                            <button type="submit" className={buttonClasses}>Save Profile</button>
                            <button type="button" onClick={handleGenerateSummary} className={secondaryButtonClasses} disabled={isSummaryLoading}>
                                {isSummaryLoading ? 'Generating...' : 'Generate Health Summary'}
                            </button>
                        </div>
                    </form>

                    {/* Health Summary Display */}
                    {healthSummary && (
                        <div className="mt-12 p-6 bg-blue-50 rounded-xl shadow-inner border border-blue-200">
                            <h3 className="text-2xl font-bold text-blue-800 mb-4 text-center">Your Personalized Health Summary</h3>
                            <div className="prose max-w-none text-gray-800 leading-relaxed" dangerouslySetInnerHTML={{ __html: healthSummary }}></div>
                        </div>
                    )}
                    {isSummaryLoading && (
                        <div className="mt-8 text-center text-blue-600 font-semibold flex items-center justify-center space-x-2">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                            <span>Generating health summary, please wait...</span>
                        </div>
                    )}
                </section>

                {/* Report Analysis Section */}
                <section id="report-analysis" className="bg-white p-8 rounded-xl shadow-lg mb-12">
                    <h2 className="text-4xl font-bold text-center text-gray-900 mb-8">Medical Report Analysis</h2>
                    <p className="text-center text-gray-600 mb-6">Upload an image of your medical report (e.g., blood test, X-ray report) for AI analysis.</p>
                    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 mb-6">
                        <label htmlFor="reportImageUpload" className="cursor-pointer bg-blue-100 text-blue-700 font-semibold py-2 px-4 rounded-full hover:bg-blue-200 transition-colors">
                            Upload Report Image
                        </label>
                        <input
                            type="file"
                            id="reportImageUpload"
                            accept="image/*"
                            onChange={handleReportFileChange}
                            className="hidden"
                        />
                        {reportImagePreview && (
                            <div className="mt-4 text-center">
                                <img src={reportImagePreview} alt="Report Preview" className="max-w-full h-48 object-contain rounded-md border border-gray-200 shadow-sm" />
                                <p className="mt-2 text-sm text-gray-500">File: {reportImage?.name}</p>
                            </div>
                        )}
                        {!reportImagePreview && (
                            <p className="mt-4 text-sm text-gray-500">No image selected</p>
                        )}
                    </div>
                    <div className="flex justify-center mb-8">
                        <button onClick={handleAnalyzeReport} className={buttonClasses} disabled={!reportImage || isReportLoading}>
                            {isReportLoading ? 'Analyzing...' : 'Analyze Report'}
                        </button>
                    </div>

                    {/* Report Analysis Display */}
                    {reportAnalysis && (
                        <div className="mt-8 p-6 bg-green-50 rounded-xl shadow-inner border border-green-200">
                            <h3 className="text-2xl font-bold text-green-800 mb-4 text-center">AI Report Analysis</h3>
                            <div className="prose max-w-none text-gray-800 leading-relaxed" dangerouslySetInnerHTML={{ __html: reportAnalysis }}></div>
                        </div>
                    )}
                    {isReportLoading && (
                        <div className="mt-8 text-center text-green-600 font-semibold flex items-center justify-center space-x-2">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
                            <span>Analyzing report, this may take a moment...</span>
                        </div>
                    )}
                </section>
            </main>

            {/* AI Chatbot Component */}
            <AiChatbot
                biodata={formData}
                isVisible={isChatbotVisible}
                onClose={() => setIsChatbotVisible(false)}
            />

            {/* Chatbot Toggle Button */}
            <button
                onClick={() => setIsChatbotVisible(!isChatbotVisible)}
                className="fixed bottom-5 right-5 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg z-40 transition-all duration-300 transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-300"
                aria-label="Toggle AI Chatbot"
            >
                <i className="fas fa-comments text-2xl"></i>
            </button>

            {/* Font Awesome for Icons */}
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css"></link>
        </div>
    );
}

