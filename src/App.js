import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'; // Removed signInWithCustomToken
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore';

// Create a context for Firebase and user information
const AppContext = createContext(null);

const App = () => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [tasks, setTasks] = useState([]);
    const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'createTask', 'editTask'
    const [editingTask, setEditingTask] = useState(null); // Task object when editing

    // Firebase Initialization and Authentication
    useEffect(() => {
        // Your web app's Firebase configuration from the user's provided details
        const appId = "my-task-manager-app-1aee5"; // Directly using your projectId here
        const firebaseConfig = {
            apiKey: "AIzaSyBvw6fj6hoQj22qCSfrXURgrmup5eCOy2c",
            authDomain: "my-task-manager-app-1aee5.firebaseapp.com",
            projectId: "my-task-manager-app-1aee5",
            storageBucket: "my-task-manager-app-1aee5.firebasestorage.app",
            messagingSenderId: "40576326590",
            appId: "1:40576326590:web:59aca6cc8e8777cc87b7ef",
            measurementId: "G-BXGD3ZBYJE" // Not used in this app, but included as provided
        };

        if (!Object.keys(firebaseConfig).length) {
            console.error("Firebase config is missing. Cannot initialize Firebase.");
            return;
        }

        try {
            const app = initializeApp(firebaseConfig);
            const authInstance = getAuth(app);
            const dbInstance = getFirestore(app);

            setAuth(authInstance);
            setDb(dbInstance);

            const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
                if (user) {
                    setUserId(user.uid);
                    console.log("User signed in:", user.uid);
                } else {
                    console.log("No user signed in. Attempting anonymous sign-in...");
                    try {
                        // For local development, we sign in anonymously as custom tokens are not provided
                        await signInAnonymously(authInstance);
                        console.log("Signed in anonymously.");
                    } catch (error) {
                        console.error("Firebase Auth error:", error);
                    }
                }
                setIsAuthReady(true);
            });

            return () => unsubscribe();
        } catch (error) {
            console.error("Error initializing Firebase:", error);
        }
    }, []);

    // Fetch tasks when Firebase is ready and user is authenticated
    useEffect(() => {
        if (db && userId && isAuthReady) {
            // Use the projectId from your firebaseConfig for the collection path
            const publicTasksRef = collection(db, `artifacts/${"my-task-manager-app-1aee5"}/public/data/tasks`);
            // Note: Firebase doesn't allow orderBy on multiple fields without specific indexes.
            // We'll fetch all and sort in memory if needed.
            const q = query(publicTasksRef);

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const fetchedTasks = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                // Sort tasks by due date or priority in memory if desired
                fetchedTasks.sort((a, b) => {
                    if (a.dueDate && b.dueDate) {
                        return new Date(a.dueDate) - new Date(b.dueDate);
                    }
                    return 0;
                });
                setTasks(fetchedTasks);
                console.log("Tasks fetched:", fetchedTasks.length);
            }, (error) => {
                console.error("Error fetching tasks:", error);
            });

            return () => unsubscribe();
        }
    }, [db, userId, isAuthReady]);

    const navigateTo = (view, task = null) => {
        setCurrentView(view);
        if (view === 'editTask' && task) {
            setEditingTask(task);
        } else {
            setEditingTask(null);
        }
    };

    const handleTaskAdded = () => {
        navigateTo('dashboard');
    };

    const handleTaskUpdated = () => {
        navigateTo('dashboard');
    };

    return (
        <AppContext.Provider value={{ db, auth, userId, isAuthReady, tasks, setTasks, navigateTo }}>
            <div className="min-h-screen bg-gradient-to-br from-purple-100 via-blue-100 to-green-100 font-sans text-gray-800 p-4 sm:p-6 lg:p-8">
                <header className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 sm:p-6 rounded-xl shadow-lg mb-8">
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-blue-600 mb-4 sm:mb-0">Task Manager</h1>
                    <div className="flex space-x-2 sm:space-x-4">
                        <button
                            onClick={() => navigateTo('dashboard')}
                            className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 ease-in-out
                                ${currentView === 'dashboard' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-blue-700 hover:bg-blue-50 hover:text-blue-600'}
                                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
                        >
                            Dashboard
                        </button>
                        <button
                            onClick={() => navigateTo('createTask')}
                            className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 ease-in-out
                                ${currentView === 'createTask' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-blue-700 hover:bg-blue-50 hover:text-blue-600'}
                                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50`}
                        >
                            New Task
                        </button>
                    </div>
                </header>

                <main className="container mx-auto">
                    {currentView === 'dashboard' && (
                        <Dashboard tasks={tasks} userId={userId} navigateTo={navigateTo} />
                    )}
                    {currentView === 'createTask' && (
                        <TaskForm onTaskSubmit={handleTaskAdded} />
                    )}
                    {currentView === 'editTask' && editingTask && (
                        <TaskForm onTaskSubmit={handleTaskUpdated} initialTask={editingTask} />
                    )}
                </main>
            </div>
        </AppContext.Provider>
    );
};

// Dashboard Component
const Dashboard = ({ tasks, userId, navigateTo }) => {
    const [filter, setFilter] = useState('all'); // 'all', 'assigned', 'completed', 'high', 'medium', 'low'
    const [searchTerm, setSearchTerm] = useState('');
    const [showDownloadModal, setShowDownloadModal] = useState(false);
    const { db } = useContext(AppContext);

    // Filtered and searched tasks
    const filteredTasks = tasks.filter(task => {
        const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              task.description.toLowerCase().includes(searchTerm.toLowerCase());

        if (filter === 'all') {
            return matchesSearch;
        } else if (filter === 'assigned') {
            return task.assignedTo && task.assignedTo.includes(userId) && matchesSearch;
        } else if (filter === 'completed') {
            return task.status === 'completed' && matchesSearch;
        } else if (['high', 'medium', 'low'].includes(filter)) {
            return task.priority === filter && matchesSearch;
        }
        return matchesSearch;
    });

    // Separate tasks for dashboard sections
    const myTasks = tasks.filter(task => task.assignedTo && task.assignedTo.includes(userId) && task.status !== 'completed');
    const dueSoonTasks = tasks.filter(task => {
        if (task.status === 'completed') return false;
        if (!task.dueDate) return false;
        const dueDate = new Date(task.dueDate);
        const now = new Date();
        const diffTime = Math.abs(dueDate.getTime() - now.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7 && dueDate >= now; // Due within 7 days and not past due
    }).sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));
    const completedTasks = tasks.filter(task => task.status === 'completed');

    const downloadCsv = () => {
        if (!tasks.length) {
            // Using a modal instead of alert()
            setShowDownloadModal(false); // Close current modal
            // You might want a separate "No data" modal here
            alert("No tasks to download."); // Using alert for simplicity, but a modal is preferred
            return;
        }

        const headers = ["ID", "Title", "Description", "Due Date", "Priority", "Status", "Assigned To", "Checklist", "Attachments", "Created By", "Created At"];
        const rows = tasks.map(task => [
            task.id,
            task.title,
            task.description,
            task.dueDate || '',
            task.priority || '',
            task.status || '',
            (task.assignedTo || []).join(', '),
            JSON.stringify(task.checklist || []),
            (task.attachments || []).join(', '),
            task.createdBy || '',
            task.createdAt?.toDate ? task.createdAt.toDate().toISOString() : ''
        ]);

        let csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.map(field => `"${String(field).replace(/"/g, '""')}"`).join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "tasks_report.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setShowDownloadModal(false);
    };


    return (
        <div className="space-y-8">
            {userId && (
                 <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
                    <p className="text-lg font-medium text-gray-700">Your User ID: <span className="font-semibold text-blue-600 break-all">{userId}</span></p>
                    <p className="text-sm text-gray-500 mt-2">Share this ID with teammates to assign tasks to them.</p>
                 </div>
            )}

            {/* Overview Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-blue-500">
                    <h3 className="text-xl font-bold text-blue-700 mb-2">My Assigned Tasks</h3>
                    <p className="text-4xl font-extrabold text-blue-600">{myTasks.length}</p>
                    <p className="text-gray-500">Tasks assigned to me (excluding completed)</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-yellow-500">
                    <h3 className="text-xl font-bold text-yellow-700 mb-2">Due Soon</h3>
                    <p className="text-4xl font-extrabold text-yellow-600">{dueSoonTasks.length}</p>
                    <p className="text-gray-500">Tasks due in the next 7 days</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-md border-t-4 border-green-500">
                    <h3 className="text-xl font-bold text-green-700 mb-2">Completed Tasks</h3>
                    <p className="text-4xl font-extrabold text-green-600">{completedTasks.length}</p>
                    <p className="text-gray-500">All completed tasks</p>
                </div>
            </div>

            {/* Task List and Filters */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 space-y-4 sm:space-y-0 sm:space-x-4">
                    <h2 className="text-2xl font-bold text-gray-800">All Tasks</h2>
                    <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
                        <input
                            type="text"
                            placeholder="Search tasks..."
                            className="w-full sm:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <select
                            className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-200 bg-white"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        >
                            <option value="all">All</option>
                            <option value="assigned">Assigned to Me</option>
                            <option value="completed">Completed</option>
                            <option value="high">High Priority</option>
                            <option value="medium">Medium Priority</option>
                            <option value="low">Low Priority</option>
                        </select>
                        <button
                            onClick={() => setShowDownloadModal(true)}
                            className="w-full sm:w-auto px-4 py-2 bg-purple-500 text-white rounded-lg font-semibold hover:bg-purple-600 shadow-md transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50"
                        >
                            Download Report
                        </button>
                    </div>
                </div>

                {/* Download Modal */}
                {showDownloadModal && (
                    <Modal onClose={() => setShowDownloadModal(false)}>
                        <h3 className="text-xl font-bold mb-4">Download Task Report</h3>
                        <p className="mb-6">Do you want to download the current task data as a CSV file?</p>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setShowDownloadModal(false)}
                                className="px-5 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={downloadCsv}
                                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-200"
                            >
                                Download
                            </button>
                        </div>
                    </Modal>
                )}


                {filteredTasks.length === 0 ? (
                    <p className="text-center text-gray-500 text-lg py-10">No tasks found matching your criteria. Why not create a new one?</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredTasks.map(task => (
                            <TaskCard key={task.id} task={task} userId={userId} navigateTo={navigateTo} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// Task Card Component
const TaskCard = ({ task, userId, navigateTo }) => {
    const { db } = useContext(AppContext);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'high': return 'text-red-600 bg-red-100';
            case 'medium': return 'text-yellow-600 bg-yellow-100';
            case 'low': return 'text-green-600 bg-green-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return 'text-green-600 bg-green-100';
            case 'in-progress': return 'text-blue-600 bg-blue-100';
            case 'pending': return 'text-orange-600 bg-orange-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    const handleChecklistToggle = async (itemIndex) => {
        if (!db) { console.error("Firestore not initialized."); return; }

        const updatedChecklist = task.checklist.map((item, idx) =>
            idx === itemIndex ? { ...item, completed: !item.completed } : item
        );

        // Determine new status
        let newStatus = 'pending';
        if (updatedChecklist.every(item => item.completed)) {
            newStatus = 'completed';
        } else if (updatedChecklist.some(item => item.completed)) {
            newStatus = 'in-progress';
        }

        try {
            const taskRef = doc(db, `artifacts/${"my-task-manager-app-1aee5"}/public/data/tasks`, task.id);
            await updateDoc(taskRef, {
                checklist: updatedChecklist,
                status: newStatus,
            });
            console.log("Checklist item and task status updated successfully!");
        } catch (error) {
            console.error("Error updating checklist or task status:", error);
        }
    };

    const handleDeleteTask = async () => {
        if (!db) { console.error("Firestore not initialized."); return; }
        try {
            const taskRef = doc(db, `artifacts/${"my-task-manager-app-1aee5"}/public/data/tasks`, task.id);
            await deleteDoc(taskRef);
            console.log("Task deleted successfully!");
            setShowDeleteModal(false);
        } catch (error) {
            console.error("Error deleting task:", error);
        }
    };

    const calculateProgress = () => {
        if (!task.checklist || task.checklist.length === 0) return 0;
        const completedItems = task.checklist.filter(item => item.completed).length;
        return (completedItems / task.checklist.length) * 100;
    };

    const progress = calculateProgress();

    return (
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-200 flex flex-col">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">{task.title}</h3>
            <p className="text-sm text-gray-600 mb-4 line-clamp-3">{task.description}</p>

            <div className="flex flex-wrap items-center gap-2 mb-4">
                {task.dueDate && (
                    <span className="flex items-center text-sm text-gray-700 bg-gray-50 px-3 py-1 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(task.dueDate).toLocaleDateString()}
                    </span>
                )}
                {task.priority && (
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${getPriorityColor(task.priority)}`}>
                        {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority
                    </span>
                )}
                {task.status && (
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${getStatusColor(task.status)}`}>
                        {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                    </span>
                )}
            </div>

            {task.checklist && task.checklist.length > 0 && (
                <div className="mb-4">
                    <h4 className="text-md font-medium text-gray-700 mb-2">Checklist:</h4>
                    <div className="space-y-1">
                        {task.checklist.map((item, index) => (
                            <div key={index} className="flex items-center">
                                <input
                                    type="checkbox"
                                    checked={item.completed}
                                    onChange={() => handleChecklistToggle(index)}
                                    className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                                    id={`checkbox-${task.id}-${index}`}
                                />
                                <label
                                    htmlFor={`checkbox-${task.id}-${index}`}
                                    className={`ml-2 text-sm ${item.completed ? 'line-through text-gray-500' : 'text-gray-700'}`}
                                >
                                    {item.text}
                                </label>
                            </div>
                        ))}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                        <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                    </div>
                    <p className="text-right text-xs text-gray-500 mt-1">{Math.round(progress)}% complete</p>
                </div>
            )}

            {task.assignedTo && task.assignedTo.length > 0 && (
                <div className="mb-4">
                    <h4 className="text-md font-medium text-gray-700 mb-2">Assigned To:</h4>
                    <div className="flex flex-wrap gap-2">
                        {task.assignedTo.map((assignedUserId, index) => (
                            <span key={index} className="text-xs px-3 py-1 bg-blue-50 text-blue-700 rounded-full">
                                {assignedUserId === userId ? 'Me' : assignedUserId.substring(0, 8) + '...'}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {task.attachments && task.attachments.length > 0 && (
                <div className="mb-4">
                    <h4 className="text-md font-medium text-gray-700 mb-2">Attachments:</h4>
                    <div className="space-y-1">
                        {task.attachments.map((link, index) => (
                            <a key={index} href={link} target="_blank" rel="noopener noreferrer" className="flex items-center text-blue-600 hover:underline text-sm truncate">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-.758l3.656-3.656m-7.468 7.468L12 10.5" />
                                </svg>
                                {link.split('/').pop()}
                            </a>
                        ))}
                    </div>
                </div>
            )}

            <div className="mt-auto flex justify-end space-x-3 pt-4 border-t border-gray-100">
                <button
                    onClick={() => navigateTo('editTask', task)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 shadow-md transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 flex items-center"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                    Edit
                </button>
                <button
                    onClick={() => setShowDeleteModal(true)}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 shadow-md transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 flex items-center"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                </button>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <Modal onClose={() => setShowDeleteModal(false)}>
                    <h3 className="text-xl font-bold mb-4">Confirm Delete</h3>
                    <p className="mb-6">Are you sure you want to delete the task: <span className="font-semibold">{task.title}</span>? This action cannot be undone.</p>
                    <div className="flex justify-end space-x-3">
                        <button
                            onClick={() => setShowDeleteModal(false)}
                            className="px-5 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition duration-200"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDeleteTask}
                            className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-200"
                        >
                            Delete
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

// Task Form Component (for Create and Edit)
const TaskForm = ({ onTaskSubmit, initialTask = null }) => {
    const { db, userId } = useContext(AppContext);
    const [title, setTitle] = useState(initialTask?.title || '');
    const [description, setDescription] = useState(initialTask?.description || '');
    const [dueDate, setDueDate] = useState(initialTask?.dueDate || '');
    const [priority, setPriority] = useState(initialTask?.priority || 'medium');
    const [assignedTo, setAssignedTo] = useState(initialTask?.assignedTo ? initialTask.assignedTo.join(', ') : userId || ''); // Pre-fill with current user ID
    const [checklistItems, setChecklistItems] = useState(initialTask?.checklist || [{ text: '', completed: false }]);
    const [attachmentLinks, setAttachmentLinks] = useState(initialTask?.attachments ? initialTask.attachments.join(', ') : '');
    const [errorMessage, setErrorMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        // When editing an existing task, pre-fill assignedTo with current user if not already present
        if (initialTask && userId && !initialTask.assignedTo.includes(userId)) {
             setAssignedTo(initialTask.assignedTo.concat(userId).join(', '));
        } else if (!initialTask && userId) {
            // For new tasks, default assignedTo to current user's ID
            setAssignedTo(userId);
        }
    }, [initialTask, userId]);


    const handleChecklistItemChange = (index, value) => {
        const newChecklistItems = [...checklistItems];
        newChecklistItems[index].text = value;
        setChecklistItems(newChecklistItems);
    };

    const addChecklistItem = () => {
        setChecklistItems([...checklistItems, { text: '', completed: false }]);
    };

    const removeChecklistItem = (index) => {
        const newChecklistItems = checklistItems.filter((_, i) => i !== index);
        setChecklistItems(newChecklistItems);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage('');
        setIsLoading(true);

        if (!title.trim() || !description.trim()) {
            setErrorMessage('Title and Description are required.');
            setIsLoading(false);
            return;
        }

        if (!db || !userId) {
            setErrorMessage("Firestore or User ID not available. Please try again.");
            setIsLoading(false);
            return;
        }

        const assignedToArray = assignedTo.split(',').map(id => id.trim()).filter(id => id);
        const attachmentsArray = attachmentLinks.split(',').map(link => link.trim()).filter(link => link);
        const filteredChecklist = checklistItems.filter(item => item.text.trim() !== '');

        // Determine initial status based on checklist
        let status = 'pending';
        if (filteredChecklist.length > 0 && filteredChecklist.every(item => item.completed)) {
            status = 'completed';
        } else if (filteredChecklist.length > 0 && filteredChecklist.some(item => item.completed)) {
            status = 'in-progress';
        }

        const taskData = {
            title,
            description,
            dueDate: dueDate || null,
            priority,
            assignedTo: assignedToArray,
            checklist: filteredChecklist,
            attachments: attachmentsArray,
            status,
            createdBy: userId,
            createdAt: serverTimestamp(),
        };

        try {
            if (initialTask) {
                // Update existing task
                const taskRef = doc(db, `artifacts/${"my-task-manager-app-1aee5"}/public/data/tasks`, initialTask.id);
                await updateDoc(taskRef, taskData);
                console.log("Task updated successfully!");
            } else {
                // Add new task
                const docRef = await addDoc(collection(db, `artifacts/${"my-task-manager-app-1aee5"}/public/data/tasks`), taskData);
                console.log("Task added with ID: ", docRef.id);
            }
            onTaskSubmit(); // Navigate back to dashboard or show success
        } catch (error) {
            console.error("Error adding/updating task:", error);
            setErrorMessage("Failed to save task. " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">{initialTask ? 'Edit Task' : 'Create New Task'}</h2>
            {errorMessage && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                    <span className="block sm:inline">{errorMessage}</span>
                </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        id="title"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-red-500">*</span></label>
                    <textarea
                        id="description"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-200 h-24 resize-y"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        required
                    ></textarea>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                        <input
                            type="date"
                            id="dueDate"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                            value={dueDate}
                            onChange={(e) => setDueDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                        <select
                            id="priority"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-200 bg-white"
                            value={priority}
                            onChange={(e) => setPriority(e.target.value)}
                        >
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label htmlFor="assignedTo" className="block text-sm font-medium text-gray-700 mb-1">Assigned To (comma-separated User IDs)</label>
                    <input
                        type="text"
                        id="assignedTo"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                        placeholder="e.g., user123, user456"
                        value={assignedTo}
                        onChange={(e) => setAssignedTo(e.target.value)}
                    />
                     <p className="text-xs text-gray-500 mt-1">
                        Use the full User ID (e.g., from the dashboard) to assign tasks. Automatically includes your ID.
                    </p>
                </div>

                {/* Checklist Section */}
                <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="text-md font-medium text-gray-700 mb-3">Checklist</h3>
                    {checklistItems.map((item, index) => (
                        <div key={index} className="flex items-center space-x-2 mb-2">
                            <input
                                type="text"
                                className="flex-grow px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                                placeholder={`Checklist item ${index + 1}`}
                                value={item.text}
                                onChange={(e) => handleChecklistItemChange(index, e.target.value)}
                            />
                            {checklistItems.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removeChecklistItem(index)}
                                    className="p-1 text-red-500 hover:text-red-700 rounded-full hover:bg-red-50 transition duration-200"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    ))}
                    <button
                        type="button"
                        onClick={addChecklistItem}
                        className="flex items-center px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition duration-200 mt-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Add Item
                    </button>
                </div>

                {/* Attachments Section */}
                <div>
                    <label htmlFor="attachments" className="block text-sm font-medium text-gray-700 mb-1">Attachment Links (comma-separated URLs)</label>
                    <input
                        type="text"
                        id="attachments"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                        placeholder="e.g., https://example.com/doc.pdf, https://another.link/image.jpg"
                        value={attachmentLinks}
                        onChange={(e) => setAttachmentLinks(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Enter full URLs for any relevant files or links.
                    </p>
                </div>

                <div className="flex justify-end space-x-4 mt-6">
                    <button
                        type="button"
                        onClick={() => onTaskSubmit()} // Go back without saving
                        className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition duration-200"
                        disabled={isLoading}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 shadow-md transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 flex items-center justify-center"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <>{initialTask ? 'Update Task' : 'Create Task'}</>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

// Generic Modal Component
const Modal = ({ children, onClose }) => {
    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 sm:p-8 w-full max-w-sm relative transform transition-all duration-300 scale-100 opacity-100">
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full p-1"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                {children}
            </div>
        </div>
    );
};

export default App;
