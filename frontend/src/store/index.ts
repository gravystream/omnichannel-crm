import { configureStore, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import type { AuthState, User, Conversation, Customer, Resolution, UIState, Notification } from '../types';

// Auth Slice
const initialAuthState: AuthState = {
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState: initialAuthState,
  reducers: {
    setCredentials: (state, action: PayloadAction<{ user: User; token: string }>) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.isLoading = false;
      state.error = null;
      localStorage.setItem('token', action.payload.token);
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.isLoading = false;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      localStorage.removeItem('token');
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    updateStatus: (state, action: PayloadAction<User['status']>) => {
      if (state.user) {
        state.user.status = action.payload;
      }
    },
  },
});

// Conversations Slice
interface ConversationsState {
  items: Conversation[];
  activeId: string | null;
  isLoading: boolean;
  filters: {
    status?: string;
    channel?: string;
    assignedTo?: string;
  };
}

const conversationsSlice = createSlice({
  name: 'conversations',
  initialState: {
    items: [],
    activeId: null,
    isLoading: false,
    filters: {},
  } as ConversationsState,
  reducers: {
    setConversations: (state, action: PayloadAction<Conversation[]>) => {
      state.items = action.payload;
      state.isLoading = false;
    },
    addConversation: (state, action: PayloadAction<Conversation>) => {
      state.items.unshift(action.payload);
    },
    updateConversation: (state, action: PayloadAction<Partial<Conversation> & { id: string }>) => {
      const index = state.items.findIndex(c => c.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = { ...state.items[index], ...action.payload };
      }
    },
    setActiveConversation: (state, action: PayloadAction<string | null>) => {
      state.activeId = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setFilters: (state, action: PayloadAction<ConversationsState['filters']>) => {
      state.filters = action.payload;
    },
  },
});

// Customers Slice
interface CustomersState {
  items: Customer[];
  selectedId: string | null;
  isLoading: boolean;
}

const customersSlice = createSlice({
  name: 'customers',
  initialState: {
    items: [],
    selectedId: null,
    isLoading: false,
  } as CustomersState,
  reducers: {
    setCustomers: (state, action: PayloadAction<Customer[]>) => {
      state.items = action.payload;
      state.isLoading = false;
    },
    addCustomer: (state, action: PayloadAction<Customer>) => {
      state.items.push(action.payload);
    },
    updateCustomer: (state, action: PayloadAction<Partial<Customer> & { id: string }>) => {
      const index = state.items.findIndex(c => c.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = { ...state.items[index], ...action.payload };
      }
    },
    setSelectedCustomer: (state, action: PayloadAction<string | null>) => {
      state.selectedId = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
});

// Resolutions Slice
interface ResolutionsState {
  items: Resolution[];
  selectedId: string | null;
  isLoading: boolean;
}

const resolutionsSlice = createSlice({
  name: 'resolutions',
  initialState: {
    items: [],
    selectedId: null,
    isLoading: false,
  } as ResolutionsState,
  reducers: {
    setResolutions: (state, action: PayloadAction<Resolution[]>) => {
      state.items = action.payload;
      state.isLoading = false;
    },
    addResolution: (state, action: PayloadAction<Resolution>) => {
      state.items.unshift(action.payload);
    },
    updateResolution: (state, action: PayloadAction<Partial<Resolution> & { id: string }>) => {
      const index = state.items.findIndex(r => r.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = { ...state.items[index], ...action.payload };
      }
    },
    setSelectedResolution: (state, action: PayloadAction<string | null>) => {
      state.selectedId = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
});

// UI Slice
const initialUIState: UIState = {
  sidebarOpen: true,
  activeConversation: null,
  selectedCustomer: null,
  theme: 'light',
  notifications: [],
};

const uiSlice = createSlice({
  name: 'ui',
  initialState: initialUIState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
    setTheme: (state, action: PayloadAction<UIState['theme']>) => {
      state.theme = action.payload;
    },
    addNotification: (state, action: PayloadAction<Omit<Notification, 'id' | 'read' | 'createdAt'>>) => {
      state.notifications.unshift({
        ...action.payload,
        id: `notif_${Date.now()}`,
        read: false,
        createdAt: new Date().toISOString(),
      });
    },
    markNotificationRead: (state, action: PayloadAction<string>) => {
      const notif = state.notifications.find(n => n.id === action.payload);
      if (notif) notif.read = true;
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },
  },
});

// Configure Store
export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    conversations: conversationsSlice.reducer,
    customers: customersSlice.reducer,
    resolutions: resolutionsSlice.reducer,
    ui: uiSlice.reducer,
  },
});

// Export actions
export const authActions = authSlice.actions;
export const conversationsActions = conversationsSlice.actions;
export const customersActions = customersSlice.actions;
export const resolutionsActions = resolutionsSlice.actions;
export const uiActions = uiSlice.actions;

// Types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
