import React, { useState, useEffect, useCallback, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signOut, signInWithCustomToken, signInWithCredential } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, setLogLevel } from 'firebase/firestore';
import './index.css'


// --- Firebase Configuration (Defined outside the component) ---
// This is moved outside the App component to prevent it from being redeclared on every render,
// which would cause an infinite loop in the Firebase initialization `useEffect`.
// NOTE: It's best practice to load these values from environment variables.

const firebaseConfig = {
  apiKey: "AIzaSyB1hrFsLEKYB4S3uu-4ODLxvupXauj49Ls",
  authDomain: "health-app-8ca1c.firebaseapp.com",
  projectId: "health-app-8ca1c",
  storageBucket: "health-app-8ca1c.firebasestorage.app",
  messagingSenderId: "534257023718",
  appId: "1:534257023718:web:648a3cd42130d29a1e9927",
//   measurementId: "G-NS7SGCP4ZZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);


// --- AI Chatbot Component (Corrected & Improved) ---
// This component is defined outside the App component as a best practice.
const AiChatbot = ({ biodata, isVisible, onClose }) => {
    const [messages, setMessages] = useState([
        { role: 'bot', text: "Hello! I'm the Health Yaar AI assistant. How can I help you today? You can ask me general health questions." }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    // Automatically scroll to the latest message
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // This function now correctly handles conversation history
    const handleSendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = { role: 'user', text: input };
        const newMessages = [...messages, userMessage]; // Store new messages array
        setMessages(newMessages); // Update UI immediately
        setInput('');
        setIsLoading(true);

        // This system prompt guides the AI's personality and rules
        const systemPrompt = `You are a friendly and helpful AI health assistant called "Health Yaar AI". A user is asking a question.
        Here is some of their health data for context (use it to provide more relevant, general advice but do not diagnose):
        - Chronic Conditions: ${biodata.chronicDiseases || 'Not provided'}
        - Allergies: ${biodata.allergies || 'Not provided'}
        - Dietary Habits: ${biodata.dietaryHabits || 'Not provided'}

        Please provide a helpful, safe, and general response.
        **IMPORTANT**: Do NOT provide a medical diagnosis or prescribe medication. Always include this disclaimer in bold at the end of your response: "**Disclaimer: This is not medical advice. Please consult a healthcare professional for personal medical advice.**"
        `;

        // Convert our app's message format to the Gemini API's format
        // We include the history so the AI remembers the conversation
        const chatHistoryForApi = newMessages
            .slice(1) // Remove the initial "Hello" message from history
            .map(msg => ({
                role: msg.role === 'bot' ? 'model' : 'user',
                parts: [{ text: msg.text }]
            }));

        try {
            // ==========================================================================
            //  CRITICAL SECURITY WARNING!
            //  This API key is exposed on the client-side. This is UNSAFE for a
            //  real application. You MUST move this logic to a secure backend
            //  (like a Firebase Cloud Function) before going public.
            // ==========================================================================
            const apiKey = ""; // LEAVE THIS EMPTY FOR THE CANVAS ENVIRONMENT
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

            const payload = {
                contents: chatHistoryForApi,
                systemInstruction: {
                    role: 'system',
                    parts: [{ text: systemPrompt }]
                }
            };

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `API Error: ${response.status}`);
            }

            const result = await response.json();

            let botResponseText = "I'm having trouble connecting right now. Please try again later.";
            if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
                botResponseText = result.candidates[0].content.parts[0].text;
            }

            setMessages(prev => [...prev, { role: 'bot', text: botResponseText }]);

        } catch (error) {
            console.error("Gemini API error:", error);
            setMessages(prev => [...prev, { role: 'bot', text: `Sorry, an error occurred: ${error.message}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-20 right-5 w-full max-w-md h-[calc(100vh-10rem)] bg-white rounded-xl shadow-2xl flex flex-col z-30 transition-all duration-300">
            <div className="p-4 bg-blue-600 text-white rounded-t-xl flex justify-between items-center">
                <h3 className="font-bold text-lg">AI Health Assistant</h3>
                <button onClick={onClose} className="text-2xl leading-none">&times;</button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
                {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-3`}>
                        <div className={`py-2 px-4 rounded-2xl max-w-[80%] ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start mb-3">
                        <div className="py-2 px-4 rounded-2xl bg-gray-200 text-gray-800">
                            <span className="animate-pulse">Typing...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-4 border-t border-gray-200">
                <div className="flex">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        className="flex-1 p-2 border border-gray-300 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Ask a health question..."
                    />
                    <button onClick={handleSendMessage} disabled={isLoading} className="bg-blue-600 text-white px-4 rounded-r-lg hover:bg-blue-700 disabled:bg-gray-400">
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

    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

    // --- Helpers ---
    const showNotification = (message, type = 'success') => {
        setNotification({ show: true, message, type });
        setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
    };

    const fileToBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]); // Get just the base64 part
        reader.onerror = error => reject(error);
    });

    // --- Firebase Initialization and Auth ---
    useEffect(() => {
        try {
            const app = initializeApp(firebaseConfig);
            const authInstance = getAuth(app);
            const dbInstance = getFirestore(app);
            // setLogLevel('debug'); // Uncomment for detailed Firebase logs during development
            setAuth(authInstance);
            setDb(dbInstance);

            const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    const initialToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
                    if (initialToken) {
                        await signInWithCustomToken(authInstance, initialToken);
                    } else {
                        // Fallback to anonymous sign-in if no token is provided
                        await signInAnonymously(authInstance);
                    }
                }
                setIsAuthReady(true);
            });
            return () => unsubscribe(); // Cleanup subscription on unmount
        } catch (error) {
            console.error("Firebase initialization failed:", error);
            showNotification('Could not connect to essential services.', 'error');
        }
        // The dependency array is empty because firebaseConfig is now stable and defined outside the component.
        // This effect will run only once.
    }, []);

    // --- Data Fetching from Firestore ---
    const fetchUserData = useCallback(async () => {
        if (!isAuthReady || !db || !userId) return;
        const userDocRef = doc(db, 'artifacts', appId, 'users', userId, 'biodata', 'profile');
        try {
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                setFormData(prevData => ({ ...prevData, ...docSnap.data() }));
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
            showNotification('Failed to load your profile data.', 'error');
        }
    }, [db, userId, isAuthReady, appId]);

    useEffect(() => {
        if (isAuthReady) {
            fetchUserData();
        }
    }, [isAuthReady, fetchUserData]);

    // --- Event Handlers ---
    const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!db || !userId) {
            showNotification('Cannot save. Not connected.', 'error');
            return;
        }
        const userDocRef = doc(db, 'artifacts', appId, 'users', userId, 'biodata', 'profile');
        try {
            await setDoc(userDocRef, formData, { merge: true });
            showNotification('Profile saved successfully!', 'success');
        } catch (error) {
            console.error("Error saving profile:", error);
            showNotification('Failed to save profile.', 'error');
        }
    };
    
    // const handleSosClick = () => {
    //     // This is a placeholder. In a real app, this would trigger an emergency protocol.
    //     alert("SOS Activated! This is a demo. In a real application, this would contact emergency services or a designated contact.");
    // };

    // --- SOS Handler ---
    const handleSosClick = () => {
        // In India, 108 is the number for medical emergencies.
        window.location.href = 'tel:108';
        setIsSosModalVisible(false);
    };

    const inputClasses = "w-full p-3 bg-gray-50 rounded-lg mt-1 border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none transition";
    const labelClasses = "block text-gray-700 font-semibold";
    
    return (
    <div className="bg-slate-50 text-gray-800 font-sans">
            {/* --- Notification Popup --- */}
            {notification.show && <div className={`fixed top-5 right-5 z-50 p-4 rounded-lg shadow-lg text-white ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>{notification.message}</div>}
            
            {/* --- SOS Confirmation Modal --- */}
            {isSosModalVisible && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
                    <div className="bg-white p-8 rounded-2xl shadow-2xl text-center max-w-sm mx-auto">
                        <h3 className="text-2xl font-bold mb-4 text-red-600">Emergency SOS</h3>
                        <p className="text-gray-700 mb-6">
                            You are about to call the medical emergency number (108).
                            This service should only be used in a genuine emergency.
                        </p>
                        <div className="flex justify-center space-x-4">
                            <button
                                onClick={() => setIsSosModalVisible(false)}
                                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-6 rounded-full transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSosClick}
                                className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-full transition-all"
                            >
                                Call Now
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>)
    

    const handleLogout = async () => {
        if (!auth) return;
        try {
            await signOut(auth);
            setUserId(null); // Clear user ID
            setIsAuthReady(false); // Reset auth state
            // Reset form to initial state
            setFormData({ fullName: '', dob: '', gender: 'Male', phone: '', location: '', height: '', weight: '', bloodGroup: '', allergies: '', chronicDiseases: '', pastMedicalHistory: '', smokingStatus: 'Never', alcoholConsumption: '', dietaryHabits: '', exercise: '', sleepHours: '', stressLevel: 'Low' });
            showNotification('You have been logged out.', 'success');
        } catch (error) {
            console.error("Logout failed:", error);
            showNotification('Logout failed.', 'error');
        }
    };

    const handleGenerateSummary = async () => {
        if (!formData.height || !formData.weight) {
            showNotification('Please provide at least height and weight for an accurate summary.', 'error');
            return;
        }
        setIsSummaryLoading(true);
        setHealthSummary('');
        try {
            // Again, this should call your secure backend endpoint
            const response = await fetch('/api/generateHealthSummary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ formData })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `Server responded with status: ${response.status}`);
            }

            const result = await response.json();
            setHealthSummary(result.html || '<p>Could not generate summary at this time.</p>');

        } catch (error) {
            console.error("Error generating summary:", error);
            setHealthSummary(`<p>An error occurred: ${error.message}</p>`);
        } finally {
            setIsSummaryLoading(false);
        }
    };

    const handleReportFileChange = (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            setReportImage(file);
            setReportImagePreview(URL.createObjectURL(file));
        } else {
            showNotification('Please upload a valid image file (PNG, JPG, etc.).', 'error');
            setReportImage(null);
            setReportImagePreview(null);
        }
    };

    const handleAnalyzeReport = async () => {
        if (!reportImage) {
            showNotification('Please upload a report image first.', 'error');
            return;
        }
        setIsReportLoading(true);
        setReportAnalysis('');
        try {
            const base64ImageData = await fileToBase64(reportImage);
            
            // This call should also go to a secure backend endpoint
            const response = await fetch('/api/analyzeReportImage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64ImageData, mimeType: reportImage.type })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `Server responded with status: ${response.status}`);
            }

            const result = await response.json();
            setReportAnalysis(result.html || '<p>Could not analyze the report.</p>');

        } catch (error) {
            console.error("Error analyzing report:", error);
            setReportAnalysis(`<p>An error occurred during analysis: ${error.message}</p>`);
        } finally {
            setIsReportLoading(false);
        }
    };

    // Reusable CSS classes for form inputs
    // const inputClasses = "w-full p-3 bg-gray-50 rounded-lg mt-1 border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none transition";
    // const labelClasses = "block text-gray-700 font-semibold";

    // --- Render JSX ---
    return (
        <div className="bg-slate-50 text-gray-800" style={{ fontFamily: "'Poppins', sans-serif" }}>
            {notification.show && (
                <div className={`fixed top-5 right-5 z-50 p-4 rounded-lg shadow-lg text-white ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                    {notification.message}
                </div>
            )}
            
            <button onClick={() => setIsChatbotVisible(true)} className="fixed bottom-5 right-5 bg-blue-600 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-xl z-20 hover:bg-blue-700 transition-transform transform hover:scale-110">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </button>
            <AiChatbot biodata={formData} isVisible={isChatbotVisible} onClose={() => setIsChatbotVisible(false)} />

            <header className="bg-white shadow-md fixed w-full z-10">
                <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-blue-600">Health <span className="text-green-500">Yaar</span></h1>
                    <nav className="hidden md:flex space-x-8 items-center">
                        <a href="#features" className="text-gray-600 hover:text-blue-600">Features</a>
                        <a href="#biodata-form" className="text-gray-600 hover:text-blue-600">Profile</a>
                        <a href="#report-analysis" className="text-gray-600 hover:text-blue-600">Analysis</a>
                        {isAuthReady && userId && <button onClick={handleLogout} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full shadow-lg transition">Logout</button>}
                        <button onClick={handleSosClick} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-full shadow-lg transition">SOS</button>
                    </nav>
                </div>
            </header>

            <main>
                <section className="pt-32 pb-20 text-white" style={{ background: 'linear-gradient(-45deg, #e0f2fe, #bfdbfe, #a5b4fc, #818cf8)', backgroundSize: '400% 400%', animation: 'gradient 15s ease infinite' }}>
                    <div className="container mx-auto px-6 text-center">
                        <h2 className="text-5xl font-bold mb-4 leading-tight">Your Personal <span className="text-green-500 bg-white bg-opacity-20 px-2 py-1 rounded">Health</span> Companion</h2>
                        <p className="text-xl mb-8 max-w-3xl mx-auto">Now with AI-powered insights to help you on your wellness journey.</p>
                    </div>
                </section>

                <section id="features" className="py-20">
                    <div className="container mx-auto px-6">
                        <h3 className="text-4xl font-bold text-center mb-12">Our Innovative <span className="text-green-500">Health</span> Features</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                            {[
                                { title: "User's Biodata", desc: "Securely store your personal, health, and lifestyle information." },
                                { title: "✨ AI Doctor Chatbot", desc: "Get instant answers to your health queries with our AI assistant." },
                                { title: "✨ Health Summary", desc: "Generate a personalized health summary and tips from your profile." },
                                { title: "✨ Report Analysis", desc: "Upload an image of a medical report for an AI-powered summary." },
                                { title: "Personal Doctor", desc: "Connect with doctors for consultations (Coming Soon)." },
                                { title: "Group Chat", desc: "Join communities to share experiences (Coming Soon)." }
                            ].map(f => (
                                <div key={f.title} className="bg-white p-8 rounded-xl shadow-lg transition transform hover:-translate-y-2 hover:shadow-2xl">
                                    <h4 className="text-2xl font-bold mb-4" dangerouslySetInnerHTML={{ __html: f.title }}></h4>
                                    <p className="text-gray-600" dangerouslySetInnerHTML={{ __html: f.desc.replace(/health/gi, '<span class="text-green-500 font-semibold">health</span>') }}></p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="biodata-form" className="bg-gray-100 py-20">
                    <div className="container mx-auto px-6">
                        <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-2xl">
                            <form onSubmit={handleFormSubmit}>
                                <h3 className="text-3xl font-bold text-center mb-2">Create Your <span className="text-green-500">Health</span> Profile</h3>
                                {userId && <p className="text-center text-gray-500 mb-8 text-sm">User ID: {userId}</p>}
                                
                                <div className="mb-10">
                                    <h4 className="text-xl font-bold border-b-2 border-blue-200 pb-2 mb-6">A: Personal Information</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div><label className={labelClasses}>Full Name</label><input type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} className={inputClasses} /></div>
                                        <div><label className={labelClasses}>Date of Birth</label><input type="date" name="dob" value={formData.dob} onChange={handleInputChange} className={inputClasses} /></div>
                                        <div><label className={labelClasses}>Gender</label><select name="gender" value={formData.gender} onChange={handleInputChange} className={inputClasses}><option>Male</option><option>Female</option><option>Other</option></select></div>
                                        <div><label className={labelClasses}>Phone Number</label><input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className={inputClasses} /></div>
                                        <div className="md:col-span-2"><label className={labelClasses}>Location</label><input type="text" name="location" value={formData.location} onChange={handleInputChange} className={inputClasses} /></div>
                                    </div>
                                </div>

                                <div className="mb-10">
                                    <h4 className="text-xl font-bold border-b-2 border-green-200 pb-2 mb-6"><span className="text-green-500">B: Health</span> Information</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div><label className={labelClasses}>Height (cm)</label><input type="number" name="height" value={formData.height} onChange={handleInputChange} className={inputClasses} /></div>
                                        <div><label className={labelClasses}>Weight (kg)</label><input type="number" name="weight" value={formData.weight} onChange={handleInputChange} className={inputClasses} /></div>
                                        <div><label className={labelClasses}>Blood Group</label><input type="text" name="bloodGroup" value={formData.bloodGroup} onChange={handleInputChange} className={inputClasses} /></div>
                                        <div><label className={labelClasses}>Known Allergies</label><input type="text" name="allergies" value={formData.allergies} onChange={handleInputChange} className={inputClasses} /></div>
                                        <div className="md:col-span-2"><label className={labelClasses}>Chronic Diseases</label><input type="text" name="chronicDiseases" value={formData.chronicDiseases} onChange={handleInputChange} className={inputClasses} /></div>
                                        <div className="md:col-span-2"><label className={labelClasses}>Past Medical History</label><textarea name="pastMedicalHistory" value={formData.pastMedicalHistory} onChange={handleInputChange} className={inputClasses} rows="3"></textarea></div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-xl font-bold border-b-2 border-blue-200 pb-2 mb-6">C: Lifestyle & Habits</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div><label className={labelClasses}>Smoking Status</label><select name="smokingStatus" value={formData.smokingStatus} onChange={handleInputChange} className={inputClasses}><option>Never</option><option>Former</option><option>Current</option></select></div>
                                        <div><label className={labelClasses}>Alcohol Consumption</label><input type="text" name="alcoholConsumption" value={formData.alcoholConsumption} onChange={handleInputChange} className={inputClasses} placeholder="e.g., Occasionally" /></div>
                                        <div className="md:col-span-2"><label className={labelClasses}>Dietary Habits</label><input type="text" name="dietaryHabits" value={formData.dietaryHabits} onChange={handleInputChange} className={inputClasses} placeholder="e.g., Vegetarian, Vegan, etc." /></div>
                                        <div className="md:col-span-2"><label className={labelClasses}>Exercise Frequency & Type</label><input type="text" name="exercise" value={formData.exercise} onChange={handleInputChange} className={inputClasses} /></div>
                                        <div><label className={labelClasses}>Sleep Patterns (avg. hours)</label><input type="number" name="sleepHours" value={formData.sleepHours} onChange={handleInputChange} className={inputClasses} /></div>
                                        <div><label className={labelClasses}>Stress Levels</label><select name="stressLevel" value={formData.stressLevel} onChange={handleInputChange} className={inputClasses}><option>Low</option><option>Moderate</option><option>High</option></select></div>
                                    </div>
                                </div>
                                
                                <div className="flex flex-col sm:flex-row justify-center items-center mt-10 space-y-4 sm:space-y-0 sm:space-x-4">
                                    <button type="submit" disabled={!isAuthReady || !userId} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-xl transition disabled:bg-gray-400">Save Profile</button>
                                    <button type="button" onClick={handleGenerateSummary} disabled={isSummaryLoading || !isAuthReady} className="w-full sm:w-auto bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-8 rounded-full shadow-xl transition disabled:bg-gray-400 flex items-center justify-center">
                                        ✨ {isSummaryLoading ? 'Generating...' : 'Generate Health Summary'}
                                    </button>
                                </div>
                            </form>
                            
                            {isSummaryLoading && (
                                <div className="mt-10 p-6 text-center">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                                    <p className="mt-4 text-gray-600">Our AI is analyzing your profile...</p>
                                </div>
                            )}
                            {healthSummary && (
                                <div className="mt-10 p-6 bg-blue-50 border border-blue-200 rounded-lg">
                                    <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: healthSummary }}></div>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                <section id="report-analysis" className="py-20">
                    <div className="container mx-auto px-6">
                        <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-2xl">
                            <h3 className="text-3xl font-bold text-center mb-8">AI <span className="text-green-500">Health</span> Report Analysis</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                <div className="flex flex-col items-center justify-center">
                                    <label htmlFor="reportUpload" className="w-full h-64 border-2 border-dashed border-gray-300 rounded-lg flex flex-col justify-center items-center cursor-pointer hover:bg-gray-50">
                                        {reportImagePreview ? (
                                            <img src={reportImagePreview} alt="Report Preview" className="max-h-full max-w-full rounded-lg object-contain" />
                                        ) : (
                                            <div className="text-center">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                <p className="mt-2 text-sm text-gray-600">Click to upload report image</p>
                                                <p className="text-xs text-gray-500">PNG, JPG, etc.</p>
                                            </div>
                                        )}
                                    </label>
                                    <input id="reportUpload" type="file" className="hidden" accept="image/*" onChange={handleReportFileChange} />
                                    <button onClick={handleAnalyzeReport} disabled={isReportLoading || !reportImage} className="w-full mt-4 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-8 rounded-full shadow-xl transition disabled:bg-gray-400 flex items-center justify-center">
                                        ✨ {isReportLoading ? 'Analyzing...' : 'Analyze Report'}
                                    </button>
                                </div>
                                <div className="h-full">
                                    {isReportLoading && (
                                        <div className="flex justify-center items-center h-full">
                                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
                                        </div>
                                    )}
                                    {!isReportLoading && reportAnalysis && (
                                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg h-full overflow-y-auto">
                                            <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: reportAnalysis }}></div>
                                        </div>
                                    )}
                                    {!isReportLoading && !reportAnalysis && (
                                        <div className="flex flex-col justify-center items-center h-full text-center text-gray-500 p-4">
                                            <p>Upload an image of your report and click "Analyze Report" to see an AI-powered summary here.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
            
            <footer id="contact" className="bg-gray-800 text-white py-12">
                <div className="container mx-auto px-6 text-center">
                    <h3 className="text-3xl font-bold">Health <span className="text-green-500">Yaar</span></h3>
                    <p className="my-4">Your partner in building a healthier future.</p>
                    <p className="text-sm text-gray-400">&copy; 2025 Health Yaar. All Rights Reserved.</p>
                </div>
            </footer>
        </div>
    );
}
