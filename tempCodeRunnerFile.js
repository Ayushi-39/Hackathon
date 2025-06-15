import React, { useState, useEffect, useCallback, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signOut, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, setLogLevel } from 'firebase/firestore';

// --- AI Chatbot Component ---
const AiChatbot = ({ biodata, isVisible, onClose }) => {
    const [messages, setMessages] = useState([
        { role: 'bot', text: "Hello! I'm the Health Yaar AI assistant. How can I help you today? You can ask me general health questions." }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = { role: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        const prompt = `You are a friendly and helpful AI health assistant called "Health Yaar AI". A user is asking a question. 
        Here is some of their health data for context (use it to provide more relevant, general advice but do not diagnose): 
        - Chronic Conditions: ${biodata.chronicDiseases || 'Not provided'}
        - Allergies: ${biodata.allergies || 'Not provided'}
        - Dietary Habits: ${biodata.dietaryHabits || 'Not provided'}
        
        The user's question is: "${input}"

        Please provide a helpful, safe, and general response. 
        *IMPORTANT*: Do NOT provide a medical diagnosis or prescribe medication. Always include a disclaimer to consult a healthcare professional for personal medical advice.
        `;
        
        try {
            const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = { contents: chatHistory };
            const apiKey = ""; // Per instructions, leave empty.
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            let botResponseText = "I'm having trouble connecting right now. Please try again later.";
            if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
                botResponseText = result.candidates[0].content.parts[0].text;
            }

            setMessages(prev => [...prev, { role: 'bot', text: botResponseText }]);
        } catch (error) {
            console.error("Gemini API error:", error);
            setMessages(prev => [...prev, { role: 'bot', text: "Sorry, I encountered an error. Please check your connection and try again." }]);
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

    // --- Firebase Configuration ---
    // These variables are expected to be injected by the environment.
    const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

    // --- Helpers ---
    const showNotification = (message, type = 'success') => {
        setNotification({ show: true, message, type });
        setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
    };

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
            setLogLevel('debug');
            setAuth(authInstance);
            setDb(dbInstance);

            const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    // Use custom token if available, otherwise sign in anonymously
                    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                        await signInWithCustomToken(authInstance, __initial_auth_token);
                    } else {
                        await signInAnonymously(authInstance);
                    }
                }
                setIsAuthReady(true);
            });
            return () => unsubscribe();
        } catch (error) {
            console.error("Firebase initialization failed:", error);
            showNotification('Could not connect to services.', 'error');
        }
    }, [firebaseConfig]); // This effect should only run once.

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
            showNotification('Failed to load your profile.', 'error');
        }
    }, [db, userId, isAuthReady, appId]);

    useEffect(() => {
        if(isAuthReady) {
            fetchUserData();
        }
    }, [isAuthReady, fetchUserData]);

    // --- Event Handlers ---
    const handleInputChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!db || !userId) { showNotification('Cannot save. Not connected.', 'error'); return; }
        const userDocRef = doc(db, 'artifacts', appId, 'users', userId, 'biodata', 'profile');
        try {
            await setDoc(userDocRef, formData, { merge: true });
            showNotification('Profile saved successfully!', 'success');
        } catch (error) { 
            console.error("Error saving profile:", error);
            showNotification('Failed to save profile.', 'error'); 
        }
    };

    const handleLogout = async () => {
        if (!auth) return;
        try {
            await signOut(auth);
            setUserId(null);
            // Reset form to initial state after logout
            setFormData({ fullName: '', dob: '', gender: 'Male', phone: '', location: '', height: '', weight: '', bloodGroup: '', allergies: '', chronicDiseases: '', pastMedicalHistory: '', smokingStatus: 'Never', alcoholConsumption: '', dietaryHabits: '', exercise: '', sleepHours: '', stressLevel: 'Low' });
            showNotification('You have been logged out.', 'success');
        } catch (error) { 
            console.error("Logout failed:", error);
            showNotification('Logout failed.', 'error'); 
        }
    };

    const handleGenerateSummary = async () => {
        if (!formData.height || !formData.weight) { showNotification('Please provide at least height and weight.', 'error'); return; }
        setIsSummaryLoading(true);
        setHealthSummary('');
        const prompt = `Analyze this health data: ${JSON.stringify(formData)}. Provide a personalized health summary. Cover BMI, lifestyle, reminders for conditions/allergies, and 3 actionable tips. Start with '<h3>Your Personalized Health Summary:</h3>'. End with '<b>Disclaimer: Not medical advice. Consult a doctor.</b>'. Use HTML for lists.`;
        try {
            const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];
            const payload = { contents: chatHistory };
            const apiKey = "";
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const result = await response.json();
            if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
                setHealthSummary(result.candidates[0].content.parts[0].text);
            } else { 
                console.error("Summary generation failed, response:", result);
                setHealthSummary('<p>Could not generate summary at this time.</p>'); 
            }
        } catch (error) { 
            console.error("Error generating summary:", error);
            setHealthSummary('<p>An error occurred while generating the summary.</p>'); 
        } finally { setIsSummaryLoading(false); }
    };

    const handleReportFileChange = (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            setReportImage(file);
            setReportImagePreview(URL.createObjectURL(file));
        } else {
            showNotification('Please upload a valid image file.', 'error');
            setReportImage(null);
            setReportImagePreview(null);
        }
    };
    
    const handleAnalyzeReport = async () => {
        if (!reportImage) { showNotification('Please upload a report image first.', 'error'); return; }
        setIsReportLoading(true);
        setReportAnalysis('');
        try {
            const base64ImageData = await fileToBase64(reportImage);
            const prompt = "You are a helpful medical assistant. Analyze the provided medical report image. Extract key metrics, their values, and their standard ranges. Provide a simple, easy-to-understand summary of the results. Do not provide a diagnosis. Conclude with '<h4>Summary</h4>' for the summary and a strong disclaimer in bold: '<b>This is not a medical diagnosis. Always consult a licensed healthcare professional for any health concerns.</b>'. Format the output using simple HTML with '<ul>' and '<li>' for lists.";
            
            const payload = {
                contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: "image/png", data: base64ImageData } }] }],
            };
            const apiKey = "";
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const result = await response.json();

            if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
                setReportAnalysis(result.candidates[0].content.parts[0].text);
            } else { 
                console.error("Report analysis failed, response:", result);
                setReportAnalysis('<p>Could not analyze the report.</p>'); 
            }
        } catch (error) { 
            console.error("Error analyzing report:", error);
            setReportAnalysis('<p>An error occurred during analysis.</p>'); 
        } finally { setIsReportLoading(false); }
    };

    const inputClasses = "w-full p-3 bg-gray-50 rounded-lg mt-1 border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:outline-none transition";
    const labelClasses = "block text-gray-700 font-semibold";
    
    return (
        <div className="bg-slate-50 text-gray-800" style={{ fontFamily: "'Poppins', sans-serif" }}>
            {notification.show && <div className={`fixed top-5 right-5 z-50 p-4 rounded-lg shadow-lg text-white ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>{notification.message}</div>}
            
            <button onClick={() => setIsChatbotVisible(true)} className="fixed bottom-5 right-5 bg-blue-600 text-white rounded-full w-16 h-16 flex items-center justify-center shadow-xl z-20 hover:bg-blue-700 transition-transform transform hover:scale-110">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </button>
            <AiChatbot biodata={formData} isVisible={isChatbotVisible} onClose={() => setIsChatbotVisible(false)} />

            <header className="bg-white shadow-md fixed w-full z-10">
                <div className="container mx-auto px-6 py-4 flex justify-between items-center"><h1 className="text-3xl font-bold text-blue-600">Health <span className="text-green-500">Yaar</span></h1><nav className="hidden md:flex space-x-8 items-center"><a href="#features" className="text-gray-600 hover:text-blue-600">Features</a><a href="#biodata-form" className="text-gray-600 hover:text-blue-600">Profile</a><a href="#report-analysis" className="text-gray-600 hover:text-blue-600">Analysis</a>{ isAuthReady && userId && <button onClick={handleLogout} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full shadow-lg transition">Logout</button> }<button className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-full shadow-lg transition">SOS</button></nav></div>
            </header>

            <main>
                <section className="pt-32 pb-20 text-white" style={{background: 'linear-gradient(-45deg, #e0f2fe, #bfdbfe, #a5b4fc, #818cf8)', backgroundSize: '400% 400%', animation: 'gradient 15s ease infinite'}}>
                    <div className="container mx-auto px-6 text-center"><h2 className="text-5xl font-bold mb-4 leading-tight">Your Personal <span className="text-green-500 bg-white bg-opacity-20 px-2 py-1 rounded">Health</span> Companion</h2><p className="text-xl mb-8 max-w-3xl mx-auto">Now with AI-powered insights to help you on your wellness journey.</p></div>
                </section>

                <section id="features" className="py-20"><div className="container mx-auto px-6"><h3 className="text-4xl font-bold text-center mb-12">Our Innovative <span className="text-green-500">Health</span> Features</h3><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">{[{ title: "User's Biodata", desc: "Securely store your personal, health, and lifestyle information." },{ title: "✨ AI Doctor Chatbot", desc: "Get instant answers to your health queries with our AI assistant." },{ title: "✨ Health Summary", desc: "Generate a personalized health summary and tips from your profile." },{ title: "✨ Report Analysis", desc: "Upload an image of a medical report for an AI-powered summary." },{ title: "Personal Doctor", desc: "Connect with doctors for consultations (Coming Soon)." },{ title: "Group Chat", desc: "Join communities to share experiences (Coming Soon)." }].map(f => (<div key={f.title} className="bg-white p-8 rounded-xl shadow-lg transition transform hover:-translate-y-2 hover:shadow-2xl"><h4 className="text-2xl font-bold mb-4" dangerouslySetInnerHTML={{ __html: f.title }}></h4><p className="text-gray-600" dangerouslySetInnerHTML={{ __html: f.desc.replace(/health/gi, '<span class="text-green-500 font-semibold">health</span>') }}></p></div>))}</div></div></section>
                
                <section id="biodata-form" className="bg-gray-100 py-20"><div className="container mx-auto px-6"><div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-2xl"><form onSubmit={handleFormSubmit}><h3 className="text-3xl font-bold text-center mb-2">Create Your <span className="text-green-500">Health</span> Profile</h3>{userId && <p className="text-center text-gray-500 mb-8 text-sm">User ID: {userId}</p>}<div className="mb-10"><h4 className="text-xl font-bold border-b-2 border-blue-200 pb-2 mb-6">A: Personal Information</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className={labelClasses}>Full Name</label><input type="text" name="fullName" value={formData.fullName} onChange={handleInputChange} className={inputClasses} /></div><div><label className={labelClasses}>Date of Birth</label><input type="date" name="dob" value={formData.dob} onChange={handleInputChange} className={inputClasses} /></div><div><label className={labelClasses}>Gender</label><select name="gender" value={formData.gender} onChange={handleInputChange} className={inputClasses}><option>Male</option><option>Female</option><option>Other</option></select></div><div><label className={labelClasses}>Phone Number</label><input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} className={inputClasses} /></div><div className="md:col-span-2"><label className={labelClasses}>Location</label><input type="text" name="location" value={formData.location} onChange={handleInputChange} className={inputClasses} /></div></div></div><div className="mb-10"><h4 className="text-xl font-bold border-b-2 border-green-200 pb-2 mb-6"><span className="text-green-500">B: Health</span> Information</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className={labelClasses}>Height (cm)</label><input type="number" name="height" value={formData.height} onChange={handleInputChange} className={inputClasses} /></div><div><label className={labelClasses}>Weight (kg)</label><input type="number" name="weight" value={formData.weight} onChange={handleInputChange} className={inputClasses} /></div><div><label className={labelClasses}>Blood Group</label><input type="text" name="bloodGroup" value={formData.bloodGroup} onChange={handleInputChange} className={inputClasses} /></div><div><label className={labelClasses}>Known Allergies</label><input type="text" name="allergies" value={formData.allergies} onChange={handleInputChange} className={inputClasses} /></div><div className="md:col-span-2"><label className={labelClasses}>Chronic Diseases</label><input type="text" name="chronicDiseases" value={formData.chronicDiseases} onChange={handleInputChange} className={inputClasses} /></div><div className="md:col-span-2"><label className={labelClasses}>Past Medical History</label><textarea name="pastMedicalHistory" value={formData.pastMedicalHistory} onChange={handleInputChange} className={inputClasses} rows="3"></textarea></div></div></div><div><h4 className="text-xl font-bold border-b-2 border-blue-200 pb-2 mb-6">C: Lifestyle & Habits</h4><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div><label className={labelClasses}>Smoking Status</label><select name="smokingStatus" value={formData.smokingStatus} onChange={handleInputChange} className={inputClasses}><option>Never</option><option>Former</option><option>Current</option></select></div><div><label className={labelClasses}>Alcohol Consumption</label><input type="text" name="alcoholConsumption" value={formData.alcoholConsumption} onChange={handleInputChange} className={inputClasses} placeholder="e.g., Occasionally" /></div><div className="md:col-span-2"><label className={labelClasses}>Dietary Habits</label><input type="text" name="dietaryHabits" value={formData.dietaryHabits} onChange={handleInputChange} className={inputClasses} placeholder="e.g., Vegetarian, Vegan, etc." /></div><div className="md:col-span-2"><label className={labelClasses}>Exercise Frequency & Type</label><input type="text" name="exercise" value={formData.exercise} onChange={handleInputChange} className={inputClasses} /></div><div><label className={labelClasses}>Sleep Patterns (avg. hours)</label><input type="number" name="sleepHours" value={formData.sleepHours} onChange={handleInputChange} className={inputClasses} /></div><div><label className={labelClasses}>Stress Levels</label><select name="stressLevel" value={formData.stressLevel} onChange={handleInputChange} className={inputClasses}><option>Low</option><option>Moderate</option><option>High</option></select></div></div></div><div className="flex flex-col sm:flex-row justify-center items-center mt-10 space-y-4 sm:space-y-0 sm:space-x-4"><button type="submit" disabled={!isAuthReady || !userId} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full shadow-xl transition disabled:bg-gray-400">Save Profile</button><button type="button" onClick={handleGenerateSummary} disabled={isSummaryLoading || !isAuthReady} className="w-full sm:w-auto bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-8 rounded-full shadow-xl transition disabled:bg-gray-400 flex items-center justify-center">✨ {isSummaryLoading ? 'Generating...' : 'Generate Health Summary'}</button></div></form>{healthSummary && <div className="mt-10 p-6 bg-blue-50 border border-blue-200 rounded-lg"><div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: healthSummary }}></div></div>}{isSummaryLoading && <div className="mt-10 p-6 text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div><p className="mt-4 text-gray-600">Our AI is analyzing your profile...</p></div>}</div></div></section>

                <section id="report-analysis" className="py-20">
                    <div className="container mx-auto px-6">
                        <div className="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-2xl">
                            <h3 className="text-3xl font-bold text-center mb-8">AI <span className="text-green-500">Health</span> Report Analysis</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                <div className="flex flex-col items-center justify-center">
                                    <label htmlFor="reportUpload" className="w-full h-64 border-2 border-dashed border-gray-300 rounded-lg flex flex-col justify-center items-center cursor-pointer hover:bg-gray-50">
                                        {reportImagePreview ? <img src={reportImagePreview} alt="Report Preview" className="max-h-full max-w-full rounded-lg" /> : <div className="text-center"><svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-4-4V6a4 4 0 014-4h10a4 4 0 014 4v6a4 4 0 01-4 4H7z" /></svg><p className="mt-2 text-sm text-gray-600">Click to upload report image</p><p className="text-xs text-gray-500">PNG, JPG up to 10MB</p></div>}
                                    </label>
                                    <input id="reportUpload" type="file" className="hidden" accept="image/*" onChange={handleReportFileChange} />
                                    <button onClick={handleAnalyzeReport} disabled={isReportLoading || !reportImage} className="w-full mt-4 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-8 rounded-full shadow-xl transition disabled:bg-gray-400 flex items-center justify-center">✨ {isReportLoading ? 'Analyzing...' : 'Analyze Report'}</button>
                                </div>
                                <div className="h-full">
                                    {isReportLoading && <div className="flex justify-center items-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div></div>}
                                    {!isReportLoading && reportAnalysis && <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg h-full overflow-y-auto"><div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: reportAnalysis }}></div></div>}
                                    {!isReportLoading && !reportAnalysis && <div className="flex flex-col justify-center items-center h-full text-center text-gray-500"><p>Upload an image of your report and click "Analyze Report" to see an AI-powered summary here.</p></div>}
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
                </div>
            </footer>
        </div>
    );
}