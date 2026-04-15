import { create } from "zustand";
import {
  CreateUserRequest,
  UpdateUserRequest,
  UserDto,
  createUser,
  deleteUser,
  fetchUsers,
  updateUser,
} from "../utils/api";

interface UsersState {
  users: UserDto[];
  isLoading: boolean;
  loadUsers: () => Promise<void>;
  addUser: (payload: CreateUserRequest) => Promise<UserDto>;
  editUser: (id: string, payload: UpdateUserRequest) => Promise<UserDto>;
  removeUser: (id: string) => Promise<void>;
}

const useUsersStore = create<UsersState>((set, get) => ({
  users: [],
  isLoading: false,
  loadUsers: async () => {
    set({ isLoading: true });
    try {
      const data = await fetchUsers();
      set({ users: data, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
    }
  },
  addUser: async (payload) => {
    const user = await createUser(payload);
    set((state) => ({ users: [...state.users, user] }));
    return user;
  },
  editUser: async (id, payload) => {
    const user = await updateUser(id, payload);
    set((state) => ({
      users: state.users.map((entry) => (entry.id === id ? user : entry)),
    }));
    return user;
  },
  removeUser: async (id) => {
    await deleteUser(id);
    set((state) => ({ users: state.users.filter((entry) => entry.id !== id) }));
  },
}));

export default useUsersStore;
