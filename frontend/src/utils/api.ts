import axios from "axios";
import { logApiCall } from "../hooks/useGlobalLogging";

const api = axios.create({
  baseURL: "/api",
  timeout: 3000, // 3 Sekunden Timeout - schneller Fallback auf Offline-Modus
  // withCredentials: HttpOnly-Cookie (Refresh-Token) wird automatisch mitgesendet
  withCredentials: true,
});

const refreshAccessToken = async (): Promise<string> => {
  const { SecureTokenManager } = await import("./securityUtils");
  // Refresh-Token kommt jetzt aus HttpOnly-Cookie (kein manuelles Lesen nötig)
  const response = await api.post<RefreshResponse>("/auth/refresh", {});
  const { accessToken } = response.data;
  SecureTokenManager.setToken(accessToken, 8);
  // Neuer Refresh-Token wird als HttpOnly-Cookie vom Backend gesetzt
  api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
  try {
    const { default: useAuthStore } = await import("../store/useAuthStore");
    useAuthStore.setState((state: any) => ({
      ...state,
      token: accessToken,
      lastActivity: Date.now(),
      user: state.user, 
    }));
  } catch (err) {
    console.warn("[API] Konnte Auth-Store nach Refresh nicht aktualisieren", err);
  }
  return accessToken;
};

let refreshPromise: Promise<string> | null = null;

// Interceptor für API-Call-Logging
api.interceptors.request.use((config) => {
  // Speichere Start-Zeit für Dauer-Berechnung
  (config as any).metadata = { startTime: Date.now() };
  return config;
});

api.interceptors.response.use(
  (response) => {
    // Erfolgreicher API-Call
    const config = response.config as any;
    const duration = Date.now() - (config.metadata?.startTime || 0);
    
    // Async logging ohne await (non-blocking)
    logApiCall(
      config.method?.toUpperCase() || 'UNKNOWN',
      config.url || '',
      response.status,
      duration
    ).catch(err => console.warn('[API] Logging failed:', err));
    
    return response;
  },
  async (error) => {
    // Fehler-API-Call
    const config = error.config as any;
    const duration = Date.now() - (config?.metadata?.startTime || 0);
    
    // Async logging ohne await (non-blocking)
    logApiCall(
      config?.method?.toUpperCase() || 'UNKNOWN',
      config?.url || '',
      error.response?.status || 0,
      duration,
      error
    ).catch(err => console.warn('[API] Logging failed:', err));

    const status = error?.response?.status;
    const isAuthEndpoint = config?.url?.includes("/auth/login") || config?.url?.includes("/auth/refresh");
    if (status === 401 && !config?._retry && !isAuthEndpoint) {
      config._retry = true;
      try {
        refreshPromise = refreshPromise || refreshAccessToken();
        const newToken = await refreshPromise;
        refreshPromise = null;
        config.headers = {
          ...(config.headers || {}),
          Authorization: `Bearer ${newToken}`,
        };
        return api(config);
      } catch (refreshError) {
        refreshPromise = null;
        try {
          const { default: useAuthStore } = await import("../store/useAuthStore");
          useAuthStore.getState().logout();
        } catch (logoutErr) {
          console.warn("[API] Logout nach Refresh-Fehler fehlgeschlagen", logoutErr);
        }
      }
    }
    
    return Promise.reject(error);
  }
);

export interface AuthProfileDto {
  id: string;
  username: string;
  displayName: string;
  role: string;
  email?: string | null;
  vehicleId?: string | null;
  branchId?: string | null;
  /** IDs der zugewiesenen WAREHOUSE-Lagerorte (leer = alle sichtbar) */
  locationIds?: string[];
  refreshInterval?: number;
  permissions: string[];
  permissionOverrides?: string[];
}

export interface BranchDto {
  id: string;
  externalCode?: string | null;
  name: string;
  address?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthProfileDto;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthProfileDto;
}

export interface PermissionDto {
  key: string;
  description: string;
}

export interface RolePermissionsDto {
  id: number;
  name: string;
  description?: string | null;
  permissions: string[];
  isSystem: boolean;
}

export interface UserPermissionsDto {
  role: string;
  effective: string[];
  overrides: string[];
  denials: string[];
}

export interface LocationDto {
  id: string;
  type: string;
  code: string;
  name?: string | null;
  parent?: LocationDto | null;
  vehicle?: VehicleDto | null;
}

export interface SupplierDto {
  id: string;
  name: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  contactName?: string | null;
  email?: string | null;
  customerNumber?: string | null;
  phone?: string | null;
  notes?: string | null;
}

export interface ItemDto {
  id: string;
  code: string;
  description: string;
  descriptionSecondary?: string | null;
  manufacturer: string;
  productGroup: string;
  qrCodeValue?: string | null;
  targetStock: number;
  minimumStock?: number | null;
  reorderPoint?: number | null;
  alternateCodes: string[];
  storageLocation?: LocationDto | null;
  supplier?: SupplierDto | null;
  price?: string | number | null;
  packSize?: number | null;
  orderQuantity?: number | null;
  currentQuantity?: number | null;
  imagePath?: string | null;
}

export interface VehicleDto {
  id: string;
  licensePlate: string;
  description: string;
}

export interface CreateItemRequest {
  code: string;
  description: string;
  descriptionSecondary?: string | null;
  manufacturer: string;
  productGroup: string;
  qrCodeValue?: string;
  targetStock?: number;
  minimumStock?: number | null;
  reorderPoint?: number | null;
  alternateCodes?: string[];
  storageLocationId?: string;
  supplierId?: string;
  price?: number;
  packSize?: number;
  orderQuantity?: number;
  currentQuantity?: number;
}

export interface UpdateItemRequest extends Partial<CreateItemRequest> {}

export interface ItemsBulkPreviewRow {
  row: number;
  code: string;
  action: "CREATE" | "UPDATE" | "SKIP" | "ERROR";
  reason: string | null;
}

export interface ItemsBulkPreviewResponse {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  rows: ItemsBulkPreviewRow[];
}

export interface CreateVehicleRequest {
  licensePlate: string;
  description: string;
}

export interface UpdateVehicleRequest extends Partial<CreateVehicleRequest> {}

export type RestockRequestStatus = "PENDING" | "APPROVED" | "FULFILLED" | "CANCELLED";

export interface RestockRequestDto {
  id: string;
  status: RestockRequestStatus;
  quantityNeeded: number;
  quantityProvided?: number;
  note: string | null;
  readyAt: string | null;
  fulfilledAt: string | null;
  createdAt: string;
  updatedAt: string;
  stockLevelId: string;
  targetQuantity: number;
  currentQuantity: number;
  item: {
    id: string;
    code: string;
    description: string;
    manufacturer: string;
    productGroup: string;
  };
  vehicle: {
    id: string;
    licensePlate: string;
    description: string;
  };
  preparedBy: {
    id: string;
    displayName: string;
  } | null;
  location: {
    id: string;
    type: string;
    code: string;
    name?: string | null;
    parentId?: string | null;
  } | null;
  warehouseAvailable: number;
}

export interface UpdateRestockStatusRequest {
  status: RestockRequestStatus;
  note?: string;
  preparedByUserId?: string;
  quantityProvided?: number;
  locationId?: string;
}

export const fetchAuthProfile = async (): Promise<AuthProfileDto> => {
  const response = await api.get<AuthProfileDto>("/auth/profile");
  return response.data;
};

export const syncOfflineMovements = async (payload: unknown) => {
  const response = await api.post<{ results: Array<{ status: "ok" | "conflict"; occurredAt: string; reason?: string }> }>("/stock/sync", payload);
  return response.data;
};

export interface ItemListResponse {
  items: ItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const fetchItems = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  manufacturer?: string;
  productGroup?: string;
}): Promise<ItemListResponse> => {
  const response = await api.get<ItemListResponse>("/items", { params });
  return response.data;
};

export const createItem = async (
  payload: CreateItemRequest,
): Promise<ItemDto> => {
  const response = await api.post<ItemDto>("/items", payload);
  return response.data;
};

export const createItemsBulk = async (
  payload: CreateItemRequest[],
): Promise<{ created: number; skipped: number; errors: string[] }> => {
  const response = await api.post<{ created: number; skipped: number; errors: string[] }>("/items/bulk", payload, { timeout: 120000 });
  return response.data;
};

export const previewItemsBulk = async (
  payload: CreateItemRequest[],
): Promise<ItemsBulkPreviewResponse> => {
  const response = await api.post<ItemsBulkPreviewResponse>("/items/bulk/preview", payload);
  return response.data;
};

export const downloadItemsMasterDataCsv = async (params?: {
  search?: string;
  manufacturer?: string;
  productGroup?: string;
}): Promise<Blob> => {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (params?.manufacturer) searchParams.set("manufacturer", params.manufacturer);
  if (params?.productGroup) searchParams.set("productGroup", params.productGroup);

  const url = `/items/export/csv${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const response = await api.get(url, {
    responseType: "blob",
    timeout: 60000,
  });
  return response.data as Blob;
};

export const updateItem = async (
  id: string,
  payload: UpdateItemRequest,
): Promise<ItemDto> => {
  const response = await api.patch<ItemDto>(`/items/${id}`, payload);
  return response.data;
};

export const updateItemsBulk = async (
  updates: Array<UpdateItemRequest & { id: string }>,
): Promise<{ updated: number; errors: string[] }> => {
  const response = await api.patch<{ updated: number; errors: string[] }>("/items/bulk", updates, { timeout: 120000 });
  return response.data;
};

export interface BranchResetPreview {
  items: number;
  stockLevels: number;
  stockMovements: number;
  locations: number;
}

export const fetchBranchResetPreview = async (branchId?: string | null): Promise<BranchResetPreview> => {
  const response = await api.get<BranchResetPreview>("/items/reset-preview", {
    params: branchId ? { branchId } : {},
  });
  return response.data;
};

export const resetBranchData = async (includeLocations: boolean, branchId?: string | null): Promise<{ deleted: number; locationsDeleted: number }> => {
  const response = await api.delete<{ deleted: number; locationsDeleted: number }>("/items/bulk", {
    params: { includeLocations: includeLocations ? "true" : "false", ...(branchId ? { branchId } : {}) },
    timeout: 120000,
  });
  return response.data;
};

export const fetchItemById = async (id: string): Promise<ItemDto> => {
  const response = await api.get<ItemDto>(`/items/${id}`);
  return response.data;
};

export const deleteItem = async (id: string): Promise<void> => {
  await api.delete(`/items/${id}`);
};

export const uploadItemImage = async (id: string, file: File): Promise<ItemDto> => {
  const formData = new FormData();
  formData.append("image", file);
  const response = await api.post<ItemDto>(`/items/${id}/image`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const deleteItemImage = async (id: string): Promise<ItemDto> => {
  const response = await api.delete<ItemDto>(`/items/${id}/image`);
  return response.data;
};

export const getItemImageUrl = (id: string): string => {
  const baseUrl = (api.defaults.baseURL || "/api").replace(/\/$/, "");
  return `${baseUrl}/items/${id}/image`;
};

export const findItemByAnyCode = async (code: string): Promise<ItemDto | null> => {
  try {
    const response = await api.get<ItemDto>(`/items/by-code/${encodeURIComponent(code)}`);
    return response.data;
  } catch (error: any) {
    if (error?.response?.status === 404) {
      return null;
    }
    throw error;
  }
};

export const fetchVehicles = async (): Promise<VehicleDto[]> => {
  const response = await api.get<VehicleDto[]>("/vehicles");
  return response.data;
};

// Locations
export const fetchLocations = async (params?: {
  type?: string;
  parentId?: string | null;
  includeVehicles?: boolean;
  branchId?: string;
}): Promise<LocationDto[]> => {
  const response = await api.get<LocationDto[]>("/locations", { params });
  return response.data;
};

export const createLocation = async (payload: {
  type: string;
  code?: string;
  name?: string;
  parentId?: string;
}): Promise<LocationDto> => {
  const response = await api.post<LocationDto>("/locations", payload);
  return response.data;
};

export const updateLocation = async (
  id: string,
  payload: { code?: string; name?: string; parentId?: string | null },
): Promise<LocationDto> => {
  const response = await api.patch<LocationDto>(`/locations/${id}`, payload);
  return response.data;
};

export const deleteLocation = async (id: string): Promise<void> => {
  await api.delete(`/locations/${id}`);
};

// Suppliers
export const fetchSuppliers = async (): Promise<SupplierDto[]> => {
  const response = await api.get<SupplierDto[]>("/suppliers");
  return response.data;
};

export const createSupplier = async (
  payload: Omit<SupplierDto, "id">,
): Promise<SupplierDto> => {
  const response = await api.post<SupplierDto>("/suppliers", payload);
  return response.data;
};

export const updateSupplier = async (
  id: string,
  payload: Partial<SupplierDto>,
): Promise<SupplierDto> => {
  const response = await api.patch<SupplierDto>(`/suppliers/${id}`, payload);
  return response.data;
};

export const deleteSupplier = async (id: string): Promise<void> => {
  await api.delete(`/suppliers/${id}`);
};

export const createVehicle = async (
  payload: CreateVehicleRequest,
): Promise<VehicleDto> => {
  const response = await api.post<VehicleDto>("/vehicles", payload);
  return response.data;
};

export const updateVehicle = async (
  id: string,
  payload: UpdateVehicleRequest,
): Promise<VehicleDto> => {
  const response = await api.patch<VehicleDto>(`/vehicles/${id}`, payload);
  return response.data;
};

export const deleteVehicle = async (id: string): Promise<void> => {
  await api.delete(`/vehicles/${id}`);
};

// ── Branches ─────────────────────────────────────────────────────────────────
export const fetchBranches = async (): Promise<BranchDto[]> => {
  const response = await api.get<BranchDto[]>("/branches");
  return response.data;
};


export const createBranch = async (payload: {
  name: string;
  externalCode?: string | null;
  address?: string | null;
  active?: boolean;
}): Promise<BranchDto> => {
  const response = await api.post<BranchDto>("/branches", payload);
  return response.data;
};

export const updateBranch = async (
  id: string,
  payload: Partial<{ name: string; externalCode: string | null; address: string | null; active: boolean }>,
): Promise<BranchDto> => {
  const response = await api.patch<BranchDto>(`/branches/${id}`, payload);
  return response.data;
};

export const deleteBranch = async (id: string): Promise<void> => {
  await api.delete(`/branches/${id}`);
};

export default api;


export const checkSetupStatus = async (): Promise<{ needsSetup: boolean }> => {
  const response = await api.get<{ needsSetup: boolean }>("/setup/status", {
    headers: { 'Cache-Control': 'no-cache' }
  });
  return response.data;
};

export const completeInitialSetup = async (
  payload: { username: string; displayName: string; password: string },
): Promise<void> => {
  await api.post("/setup", payload);
};

export interface UserDto {
  id: string;
  username: string;
  displayName: string;
  email?: string | null;
  role: string;
  vehicleId?: string | null;
  branchId?: string | null;
  /** Zugewiesene WAREHOUSE-Lagerorte */
  locations?: Array<{ id: string; code: string; name: string | null }>;
  refreshInterval?: number;
}

export interface CreateUserRequest {
  username: string;
  displayName: string;
  password: string;
  email?: string;
  role: string;
  vehicleId?: string;
  branchId?: string | null;
  /** IDs der zugewiesenen WAREHOUSE-Lagerorte */
  locationIds?: string[];
  refreshInterval?: number;
}

export interface UpdateVehicleTargetRequest {
  itemId: string;
  targetQuantity: number;
}

export interface UpdateUserRequest {
  displayName?: string;
  password?: string;
  email?: string;
  role?: string;
  vehicleId?: string | null;
  branchId?: string | null;
  /** IDs der zugewiesenen WAREHOUSE-Lagerorte */
  locationIds?: string[];
  refreshInterval?: number;
}

export interface StockLevelDto {
  id: string;
  quantity: number;
  targetQuantity: number;
  item: ItemDto;
}

export interface FleetStockEntryDto {
  stockLevelId: string;
  itemId: string;
  code: string;
  description: string;
  manufacturer: string;
  productGroup: string;
  quantity: number;
  targetQuantity: number;
}

export interface FleetVehicleStockDto {
  vehicle: VehicleDto & { technicianName: string | null };
  totalQuantity: number;
  itemCount: number;
  stock: FleetStockEntryDto[];
}

export interface RecordMovementRequest {
  itemId: string;
  vehicleId?: string;
  locationId?: string;
  userId?: string;
  type: "CHECKIN" | "CHECKOUT" | "ADJUSTMENT";
  quantity: number;
  occurredAt: string;
  note?: string;
  source: string;
}

export const fetchUsers = async (): Promise<UserDto[]> => {
  const response = await api.get<UserDto[]>("/users");
  return response.data;
};

export interface TechnicianDto {
  id: string;
  displayName: string;
  vehicleId: string | null;
}

export const fetchTechnicians = async (): Promise<TechnicianDto[]> => {
  const response = await api.get<TechnicianDto[]>("/users/technicians");
  return response.data;
};

export const createUser = async (
  payload: CreateUserRequest,
): Promise<UserDto> => {
  const response = await api.post<UserDto>("/users", payload);
  return response.data;
};

export const updateUser = async (
  id: string,
  payload: UpdateUserRequest,
): Promise<UserDto> => {
  const response = await api.patch<UserDto>(`/users/${id}`, payload);
  return response.data;
};

export const deleteUser = async (id: string): Promise<void> => {
  await api.delete(`/users/${id}`);
};

export const fetchVehicleStock = async (
  vehicleId: string,
): Promise<StockLevelDto[]> => {
  const response = await api.get<StockLevelDto[]>(`/stock/vehicle/${vehicleId}`);
  return response.data;
};

export const fetchLocationStock = async (): Promise<StockLevelDto[]> => {
  const response = await api.get<StockLevelDto[]>("/stock/location-stock");
  return response.data;
};

export const updateVehicleTarget = async (
  vehicleId: string,
  payload: UpdateVehicleTargetRequest,
): Promise<StockLevelDto> => {
  const response = await api.patch<StockLevelDto>(`/stock/vehicle/${vehicleId}/target`, payload);
  return response.data;
};

export const fetchVehicleShortages = async (
  vehicleId: string,
): Promise<RestockRequestDto[]> => {
  const response = await api.get<RestockRequestDto[]>(`/stock/vehicle/${vehicleId}/shortages`);
  return response.data;
};

export const fetchRestockOverview = async (params?: { status?: RestockRequestStatus | "OPEN" }): Promise<RestockRequestDto[]> => {
  const response = await api.get<RestockRequestDto[]>("/stock/shortages", { params });
  return response.data;
};

export const updateRestockStatus = async (
  id: string,
  payload: UpdateRestockStatusRequest,
): Promise<RestockRequestDto> => {
  const response = await api.patch<RestockRequestDto>(`/stock/shortages/${id}`, payload);
  return response.data;
};

export const recordMovementsBulk = async (
  movements: RecordMovementRequest[],
): Promise<{ ok: number; failed: Array<{ index: number; reason: string }> }> => {
  const batchSize = 250;
  let ok = 0;
  const failed: Array<{ index: number; reason: string }> = [];

  for (let batchStart = 0; batchStart < movements.length; batchStart += batchSize) {
    const batch = movements.slice(batchStart, batchStart + batchSize);
    try {
      const response = await api.post<{ results: Array<{ status: string; reason?: string }> }>(
        "/stock/sync",
        { movements: batch },
      );
      response.data.results.forEach((result, i) => {
        if (result.status === "ok") {
          ok += 1;
        } else {
          failed.push({ index: batchStart + i, reason: result.reason ?? "Unbekannter Fehler" });
        }
      });
    } catch (error) {
      batch.forEach((_, i) => {
        failed.push({ index: batchStart + i, reason: (error as any)?.message ?? "Batch-Fehler" });
      });
    }
  }

  return { ok, failed };
};

export const recordMovement = async (
  payload: RecordMovementRequest,
): Promise<void> => {
  try {
    await api.post("/stock/movement", payload);
  } catch (error) {
    // Offline-Modus: Bewegung in Queue einreihen
    if (!navigator.onLine || (error as any)?.response?.status >= 500) {
      console.log('[API] Offline mode - queueing movement:', payload);
      
      // Dynamic import um zirkuläre Imports zu vermeiden
      const { default: useOfflineQueue } = await import('../store/useOfflineQueue');
      
      await useOfflineQueue.getState().enqueueMovement({
        itemId: payload.itemId,
        code: payload.itemId, // Fallback, wird vom Store korrigiert
        type: payload.type,
        quantity: payload.quantity,
        timestamp: payload.occurredAt,
        source: payload.source,
        vehicleId: payload.vehicleId,
        locationId: payload.locationId,
        userId: payload.userId,
      });
      
      // Erfolg simulieren für UI
      return;
    }
    throw error;
  }
};

// Purchasing
export type PurchaseOrderStatus = "DRAFT" | "ORDERED" | "RECEIVED" | "CANCELLED" | "ARCHIVED";

export interface PurchaseOrderLineDto {
  id: string;
  item: ItemDto;
  quantity: number;
  receivedQuantity: number;
  packSize?: number | null;
}

export interface PurchaseOrderDto {
  id: string;
  supplier: SupplierDto;
  branch?: { id: string; name: string; externalCode?: string | null } | null;
  branchId?: string | null;
  status: PurchaseOrderStatus;
  orderNumber?: string | null;
  orderedAt?: string | null;
  receivedAt?: string | null;
  note?: string | null;
  deliveryNoteNumber?: string | null;
  lines: PurchaseOrderLineDto[];
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderSuggestionDto {
  itemId: string;
  code: string;
  description: string;
  descriptionSecondary?: string | null;
  supplierId: string | null;
  supplierName: string | null;
  storageLocationId: string | null;
  targetStock: number;
  minimumStock: number | null;
  reorderPoint: number | null;
  currentQuantity: number;
  neededQuantity: number;
  availableInOtherBranches?: Array<{ branchId: string; branchName: string; quantity: number }>;
}

export interface PurchaseOrderQueryParams {
  status?: PurchaseOrderStatus;
  year?: number;
  supplierId?: string;
  sortBy?: "createdAt" | "orderedAt" | "supplier";
  sortDir?: "ASC" | "DESC";
}

export interface PurchaseOrderDocumentDto {
  year: number;
  month: number;
  filename: string;
  path: string;
  size: number;
  created: string;
  supplierId: string | null;
  supplierName: string | null;
  branchFolder: string | null;
}

export const fetchPurchaseOrders = async (params?: PurchaseOrderQueryParams): Promise<PurchaseOrderDto[]> => {
  const response = await api.get<PurchaseOrderDto[]>("/purchase-orders", { params });
  return response.data;
};

export const fetchPurchaseOrder = async (id: string): Promise<PurchaseOrderDto> => {
  const response = await api.get<PurchaseOrderDto>(`/purchase-orders/${id}`);
  return response.data;
};

export const fetchPurchaseSuggestions = async (refresh = false): Promise<PurchaseOrderSuggestionDto[]> => {
  const response = await api.get<PurchaseOrderSuggestionDto[]>("/purchase-orders/suggestions", {
    params: refresh ? { refresh: "true" } : undefined,
  });
  return response.data;
};

export const createPurchaseOrder = async (payload: {
  supplierId: string;
  orderNumber?: string;
  note?: string;
  lines: Array<{ itemId: string; quantity: number; packSize?: number }>;
}): Promise<PurchaseOrderDto> => {
  const response = await api.post<PurchaseOrderDto>("/purchase-orders", payload);
  return response.data;
};

export const updatePurchaseOrder = async (
  id: string,
  payload: { status?: PurchaseOrderStatus; orderNumber?: string; note?: string },
): Promise<PurchaseOrderDto> => {
  const response = await api.patch<PurchaseOrderDto>(`/purchase-orders/${id}`, payload);
  return response.data;
};

export const receivePurchaseOrder = async (
  id: string,
  payload: { lines: Array<{ lineId: string; receivedQuantity?: number }>; deliveryNoteNumber?: string },
): Promise<PurchaseOrderDto> => {
  const response = await api.post<PurchaseOrderDto>(`/purchase-orders/${id}/receive`, payload);
  return response.data;
};

export const deletePurchaseOrder = async (id: string): Promise<void> => {
  await api.delete(`/purchase-orders/${id}`);
};

export const addPurchaseOrderLine = async (
  orderId: string,
  payload: { itemId: string; quantity: number },
): Promise<PurchaseOrderDto> => {
  const response = await api.post<PurchaseOrderDto>(`/purchase-orders/${orderId}/lines`, payload);
  return response.data;
};

export const updatePurchaseOrderLine = async (
  orderId: string,
  lineId: string,
  payload: { quantity: number },
): Promise<PurchaseOrderDto> => {
  const response = await api.patch<PurchaseOrderDto>(`/purchase-orders/${orderId}/lines/${lineId}`, payload);
  return response.data;
};

export const deletePurchaseOrderLine = async (
  orderId: string,
  lineId: string,
): Promise<PurchaseOrderDto> => {
  const response = await api.delete<PurchaseOrderDto>(`/purchase-orders/${orderId}/lines/${lineId}`);
  return response.data;
};

export const fetchPurchaseOrderPdf = async (id: string): Promise<Blob> => {
  const response = await api.get(`/purchase-orders/${id}/pdf`, {
    responseType: "blob",
    timeout: 60000, // PDF-Generierung kann länger dauern
  });
  return response.data;
};

export const sendPurchaseOrder = async (
  id: string,
  payload?: { to?: string; subject?: string; message?: string },
): Promise<void> => {
  await api.post(`/purchase-orders/${id}/send`, payload ?? {}, {
    timeout: 30000, // 30 Sekunden Timeout für E-Mail-Versand
  });
};


export const fetchPurchaseOrderDocuments = async (params?: {
  year?: number;
  supplierId?: string;
}): Promise<PurchaseOrderDocumentDto[]> => {
  const response = await api.get<PurchaseOrderDocumentDto[]>("/purchase-orders/documents", { params });
  return response.data;
};

export const downloadPurchaseOrderDocument = async (
  docPath: string,
): Promise<Blob> => {
  const response = await api.get(
    `/purchase-orders/documents/download`,
    { params: { path: docPath }, responseType: "blob" },
  );
  return response.data;
};

export interface BelowTargetItemDto {
  stockLevelId: string;
  itemId: string;
  itemCode: string;
  itemDescription: string;
  locationLabel: string;
  quantity: number;
  targetQuantity: number;
  minimumStock: number | null;
  effectiveTarget: number;
  drivenByMinStock: boolean;
  shortage: number;
}

export const fetchBelowTargetItems = async (): Promise<BelowTargetItemDto[]> => {
  const response = await api.get<BelowTargetItemDto[]>("/stock/dashboard/below-target");
  return response.data;
};

export const fetchFleetStock = async (params?: { vehicleId?: string; search?: string }): Promise<FleetVehicleStockDto[]> => {
  const response = await api.get<FleetVehicleStockDto[]>("/stock/fleet", { params });
  return response.data;
};

export const updateUserRefreshInterval = async (userId: string, interval: number) => {
  await api.patch(`/users/${userId}`, { refreshInterval: interval });
};

// Inventory APIs
export type InventorySessionStatus = 'DRAFT' | 'SUBMITTED' | 'FINALIZED' | 'CANCELLED';

export interface InventorySessionDto {
  id: string;
  name: string;
  createdBy: string;
  location?: string | null;
  startedAt: string;
  completedAt?: string | null;
  status: InventorySessionStatus;
  submittedBy?: string | null;
  submittedAt?: string | null;
  finalizedBy?: string | null;
  finalizedAt?: string | null;
  clientChecksum?: string | null;
  serverChecksum?: string | null;
  adjustmentsApplied?: boolean;
  lines: InventoryLineDto[];
  branchId?: string | null;
  branch?: { id: string; name: string } | null;
  assignedUserIds?: string[] | null;
}

export interface InventoryLineDto {
  id: string;
  sessionId: string;
  itemId: string;
  vehicleId?: string | null;
  countedQuantity: number;
  expectedQuantity: number;
  note?: string | null;
  item: ItemDto;
  vehicle?: VehicleDto | null;
}

export interface StartInventoryRequest {
  name: string;
  createdBy: string;
  location?: string | null;
  startedAt?: string;
  assignedUserIds?: string[] | null;
}

export interface RecordInventoryLineRequest {
  sessionId: string;
  itemId: string;
  vehicleId?: string | null;
  locationId?: string | null;
  countedQuantity: number;
  expectedQuantity: number;
  note?: string | null;
}

export interface CompleteInventoryRequest {
  sessionId: string;
}

export interface InventoryTemplateMeta {
  filename: string;
  size: number;
  mimeType: string;
  uploadedBy?: string;
  uploadedAt: string;
}

export interface InventoryTemplatePlaceholderGroup {
  category: string;
  description?: string;
  placeholders: { token: string; description: string }[];
}

export interface InventoryTemplateMetaResponse {
  hasTemplate: boolean;
  meta: InventoryTemplateMeta | null;
  placeholders: InventoryTemplatePlaceholderGroup[];
}

export interface InventoryDifferenceDto {
  lineId: string;
  itemId: string;
  vehicleId?: string | null;
  itemCode: string;
  itemDescription: string;
  manufacturer: string;
  productGroup: string;
  vehicleLabel?: string | null;
  countedQuantity: number;
  expectedQuantity: number;
  delta: number;
}

export interface VehicleStatusDto {
  vehicleId: string;
  vehicleLabel: string;
  status: "DRAFT" | "SUBMITTED";
  submittedBy: string | null;
  submittedAt: string | null;
  adjustmentsApplied: boolean;
}

export interface InventoryDifferencesResponse {
  sessionId: string;
  differences: InventoryDifferenceDto[];
  totals: {
    count: number;
    deltaSum: number;
    positiveDeltaSum: number;
    negativeDeltaSum: number;
  };
}

export const fetchInventorySessions = async (): Promise<InventorySessionDto[]> => {
  const response = await api.get<InventorySessionDto[]>("/inventory");
  return response.data;
};

export const startInventorySession = async (request: StartInventoryRequest): Promise<InventorySessionDto> => {
  const response = await api.post<InventorySessionDto>("/inventory/start", request);
  return response.data;
};

export const recordInventoryLine = async (request: RecordInventoryLineRequest): Promise<InventoryLineDto> => {
  const response = await api.post<InventoryLineDto>("/inventory/line", request);
  return response.data;
};

export const completeInventorySession = async (request: CompleteInventoryRequest): Promise<void> => {
  await api.post("/inventory/complete", request);
};

export const exportInventorySession = async (
  sessionId: string,
  format: 'csv' | 'pdf' | 'xlsx' = 'csv',
  params?: { vehicleId?: string; technicianId?: string },
): Promise<Blob> => {
  const searchParams = new URLSearchParams({ format });
  if (params?.vehicleId) {
    searchParams.append("vehicleId", params.vehicleId);
  }
  if (params?.technicianId) {
    searchParams.append("technicianId", params.technicianId);
  }
  const response = await api.get(`/inventory/${sessionId}/export?${searchParams.toString()}`, {
    responseType: "blob",
    timeout: 60000, // 60 Sekunden für Export-Generierung
  });
  return response.data;
};

export const exportInventoryProtocol = async (
  sessionId: string,
  format: 'csv' | 'pdf' | 'xlsx' = 'csv',
): Promise<Blob> => {
  const searchParams = new URLSearchParams({ format });
  const response = await api.get(`/inventory/${sessionId}/export-protocol?${searchParams.toString()}`, {
    responseType: "blob",
    timeout: 60000,
  });
  return response.data;
};

export const deleteInventoryLine = async (lineId: string): Promise<void> => {
  await api.delete(`/inventory/line/${lineId}`);
};

export const deleteInventorySession = async (sessionId: string, force = false): Promise<void> => {
  await api.delete(`/inventory/session/${sessionId}${force ? "?force=true" : ""}`);
};

export const submitInventorySession = async (
  sessionId: string,
  payload?: { clientChecksum?: string; applyAdjustments?: boolean; vehicleId?: string },
): Promise<InventorySessionDto> => {
  const response = await api.patch<InventorySessionDto>(`/inventory/sessions/${sessionId}/submit`, payload ?? {});
  return response.data;
};

export const reopenInventorySession = async (sessionId: string): Promise<InventorySessionDto> => {
  const response = await api.patch<InventorySessionDto>(`/inventory/sessions/${sessionId}/reopen`);
  return response.data;
};

export const reopenInventoryVehicle = async (sessionId: string, vehicleId: string): Promise<VehicleStatusDto> => {
  const response = await api.patch<VehicleStatusDto>(`/inventory/sessions/${sessionId}/vehicle-reopen/${vehicleId}`);
  return response.data;
};

export const fetchInventoryDifferences = async (sessionId: string): Promise<InventoryDifferencesResponse> => {
  const response = await api.get<InventoryDifferencesResponse>(`/inventory/sessions/${sessionId}/differences`);
  return response.data;
};

export const fetchInventoryVehicleStatuses = async (sessionId: string): Promise<VehicleStatusDto[]> => {
  const response = await api.get<VehicleStatusDto[]>(`/inventory/sessions/${sessionId}/vehicle-statuses`);
  return response.data;
};

export const finalizeInventorySession = async (
  sessionId: string,
  payload?: { clientChecksum?: string; applyAdjustments?: boolean },
): Promise<InventorySessionDto> => {
  const response = await api.patch<InventorySessionDto>(`/inventory/sessions/${sessionId}/finalize`, payload ?? {});
  return response.data;
};

export const fetchInventoryTemplateMeta = async (): Promise<InventoryTemplateMetaResponse> => {
  const response = await api.get<InventoryTemplateMetaResponse>("/inventory/template/meta");
  return response.data;
};

export const uploadInventoryTemplate = async (file: File): Promise<InventoryTemplateMeta> => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await api.post<InventoryTemplateMeta>("/inventory/template", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const deleteInventoryTemplate = async (): Promise<void> => {
  await api.delete("/inventory/template");
};

export const downloadInventoryTemplate = async (): Promise<Blob> => {
  const response = await api.get("/inventory/template/download", { responseType: "blob" });
  return response.data;
};

// Company configuration
export interface CompanyConfigDto {
  name: string | null;
  logoDataUrl?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface UpdateCompanyConfigRequest {
  name: string;
  logoDataUrl?: string | null;
  removeLogo?: boolean;
  addressLine1?: string | null;
  addressLine2?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
}

export const fetchPublicCompanyConfig = async (): Promise<CompanyConfigDto> => {
  const response = await api.get<CompanyConfigDto>("/company/public");
  return response.data;
};

export const fetchCompanyConfig = async (): Promise<CompanyConfigDto> => {
  const response = await api.get<CompanyConfigDto>("/company");
  return response.data;
};

export const updateCompanyConfig = async (payload: UpdateCompanyConfigRequest): Promise<CompanyConfigDto> => {
  const response = await api.put<CompanyConfigDto>("/company", payload);
  return response.data;
};

// Passwort-Änderung
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export const changePassword = async (request: ChangePasswordRequest): Promise<{ message: string }> => {
  const response = await api.post<{ message: string }>("/auth/change-password", request);
  return response.data;
};

// Email-Reset Funktionen
export interface SendResetEmailRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export const sendResetEmail = async (request: SendResetEmailRequest): Promise<{ message: string }> => {
  const response = await api.post<{ message: string }>("/auth/send-reset-email", request);
  return response.data;
};

export const resetPassword = async (request: ResetPasswordRequest): Promise<{ message: string }> => {
  const response = await api.post<{ message: string }>("/auth/reset-password", request);
  return response.data;
};

// E-Mail Konfiguration
export interface EmailConfigDto {
  host?: string;
  port?: number;
  secure?: boolean;
  auth?: {
    user?: string;
  };
  from?: string;
}

// E-Mail Vorlagen
export interface EmailTemplate {
  subject: string;
  body: string;
}

export const fetchPurchaseOrderEmailTemplate = async (): Promise<EmailTemplate> => {
  const response = await api.get<EmailTemplate>("/system-config/email-template/purchase-order");
  return response.data;
};

export const updatePurchaseOrderEmailTemplate = async (template: EmailTemplate): Promise<EmailTemplate> => {
  const response = await api.put<EmailTemplate>("/system-config/email-template/purchase-order", template);
  return response.data;
};


export interface EmailConfigResponse {
  isConfigured: boolean;
  config: EmailConfigDto | null;
}

export interface UpdateEmailSettingsRequest {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  from: string;
}

export const fetchEmailSettings = async (): Promise<EmailConfigResponse> => {
  const response = await api.get<EmailConfigResponse>("/email/config");
  return response.data;
};

export const saveEmailSettings = async (payload: UpdateEmailSettingsRequest): Promise<{ success: boolean; message: string }> => {
  const response = await api.post<{ success: boolean; message: string }>("/email/config", {
    host: payload.host,
    port: payload.port,
    secure: payload.secure,
    auth: {
      user: payload.username,
      pass: payload.password,
    },
    from: payload.from,
  });
  return response.data;
};

export const sendTestEmail = async (payload: { email: string }): Promise<{ success: boolean; message: string }> => {
  const response = await api.post<{ success: boolean; message: string }>("/email/test", payload);
  return response.data;
};

// Logging für Admins
export interface LogEntry {
  id: number;
  timestamp: string;
  level: string;
  category: string;
  action: string;
  message?: string; // Alias for action
  source?: string; // FRONTEND or BACKEND
  details?: string;
  userId?: string;
  username?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: any;
}

export interface LogFilters {
  startDate?: string;
  endDate?: string;
  userId?: string;
  category?: string;
  level?: string;
  action?: string;
  source?: string; // Filter by FRONTEND or BACKEND
  limit?: number;
  offset?: number;
}

export interface LogsResponse {
  logs: LogEntry[];
  total: number;
}

export const getLogs = async (filters: LogFilters = {}): Promise<LogsResponse> => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.append(key, value.toString());
    }
  });
  
  const response = await api.get<LogsResponse>(`/logs?${params.toString()}`);
  return response.data;
};

export const downloadLogsCSV = async (filters: LogFilters = {}): Promise<Blob> => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.append(key, value.toString());
    }
  });
  
  const response = await api.get(`/logs/download/csv?${params.toString()}`, {
    responseType: 'blob'
  });
  return response.data;
};

export const downloadLogsJSON = async (filters: LogFilters = {}): Promise<Blob> => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.append(key, value.toString());
    }
  });
  
  const response = await api.get(`/logs/download/json?${params.toString()}`, {
    responseType: 'blob'
  });
  return response.data;
};

export interface LogStats {
  totalLogs: number;
  period: string;
  byLevel: Record<string, number>;
  byCategory: Record<string, number>;
  byUser: Record<string, number>;
  recentErrors: LogEntry[];
  recentSecurity: LogEntry[];
}

export const getLogStats = async (): Promise<LogStats> => {
  const response = await api.get<LogStats>("/logs/stats");
  return response.data;
};

// Log-Aufbewahrung & Bereinigung
export const getLogRetention = async (): Promise<{ retentionDays: number }> => {
  const response = await api.get<{ retentionDays: number }>("/logs/config/retention");
  return response.data;
};

export const setLogRetention = async (retentionDays: number): Promise<{ success: boolean; retentionDays: number }> => {
  const response = await api.put<{ success: boolean; retentionDays: number }>("/logs/config/retention", { retentionDays });
  return response.data;
};

export const deleteAllLogs = async (): Promise<{ success: boolean; deletedCount: number }> => {
  const response = await api.post<{ success: boolean; deletedCount: number }>("/logs/cleanup/all", {});
  return response.data;
};

export const cleanupOldLogs = async (daysToKeep: number): Promise<{ success: boolean; deletedCount: number; daysToKeep: number }> => {
  const response = await api.post<{ success: boolean; deletedCount: number; daysToKeep: number }>("/logs/cleanup/old", { daysToKeep });
  return response.data;
};

// System-Logs abrufen (für Live-Log-Ansicht)
export interface SystemLogDto {
  id: string;
  timestamp: string;
  level: string;
  category: string;
  message: string;
  user?: { displayName: string; id: string };
  details?: any;
}

export const fetchSystemLogs = async (params?: { limit?: number; level?: string; category?: string }): Promise<SystemLogDto[]> => {
  const queryParams = new URLSearchParams();
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.level) queryParams.append('level', params.level);
  if (params?.category) queryParams.append('category', params.category);
  
  const response = await api.get<{ logs: SystemLogDto[]; total: number }>(`/logs?${queryParams.toString()}`);
  // Backend gibt { logs: [...], total: ... } zurück
  return response.data.logs || [];
};

// Stock-Repair für Manager
export interface StockDiagnosisResult {
  duplicateGroups: Array<{
    itemCode: string;
    itemDescription: string;
    duplicateStockLevels: Array<{
      id: string;
      vehicleId: string;
      vehicleLicensePlate: string;
      currentStock: number;
      targetStock: number;
    }>;
  }>;
  totalDuplicateGroups: number;
  totalAffectedStockLevels: number;
}

export interface StockRepairResult {
  totalGroupsRepaired: number;
  totalStockLevelsRemoved: number;
  details: Array<{
    itemCode: string;
    vehiclesConsolidated: string[];
    finalStockLevel: {
      vehicleId: string;
      vehicleLicensePlate: string;
      currentStock: number;
      targetStock: number;
    };
  }>;
}

export const diagnoseStockLevels = async (): Promise<StockDiagnosisResult> => {
  const response = await api.post<StockDiagnosisResult>("/stock-admin/diagnose-stock-levels");
  return response.data;
};

export const repairDuplicateStockLevels = async (): Promise<StockRepairResult> => {
  const response = await api.post<StockRepairResult>("/stock-admin/repair-duplicate-stock-levels");
  return response.data;
};

export interface CloneVehicleStockRequest {
  sourceVehicleId: string;
  targetVehicleId: string;
  copyQuantities?: boolean;
}

export const cloneVehicleStock = async (payload: CloneVehicleStockRequest): Promise<{ success: boolean; cloned: number; copyQuantities: boolean }> => {
  const response = await api.post<{ success: boolean; cloned: number; copyQuantities: boolean }>("/stock/vehicle/clone", payload);
  return response.data;
};

export const downloadItemsQrCatalog = async (params?: { search?: string; manufacturer?: string; productGroup?: string }): Promise<Blob> => {
  const sp = new URLSearchParams();
  if (params?.search) sp.set('search', params.search);
  if (params?.manufacturer) sp.set('manufacturer', params.manufacturer);
  if (params?.productGroup) sp.set('productGroup', params.productGroup);
  const url = `/reports/items/qr-catalog${sp.toString() ? `?${sp.toString()}` : ''}`;
  const response = await api.get(url, { 
    responseType: 'blob',
    timeout: 60000, // 60 Sekunden für PDF-Generierung
  });
  return response.data as Blob;
};

export const downloadVehicleQrCatalog = async (vehicleId?: string): Promise<Blob> => {
  const url = vehicleId ? `/reports/vehicle/qr-catalog?vehicleId=${encodeURIComponent(vehicleId)}` : `/reports/vehicle/qr-catalog`;
  const response = await api.get(url, { 
    responseType: 'blob',
    timeout: 60000, // 60 Sekunden für PDF-Generierung
  });
  return response.data as Blob;
};

export const removeVehicleStock = async (vehicleId: string, itemId: string): Promise<{ success: boolean; message: string }> => {
  const response = await api.post<{ success: boolean; message: string }>(`/stock/vehicle/${vehicleId}/remove/${itemId}`);
  return response.data;
};

// Auto-Backup Konfiguration
export interface AutoBackupConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string; // HH:MM
  lastBackup?: string | null;
  retentionDays?: number; // Wie lange Backups aufbewahrt werden
}

export const getAutoBackupConfig = async (): Promise<AutoBackupConfig> => {
  const response = await api.get<AutoBackupConfig>("/setup/backup/auto-config");
  return response.data;
};

// QR-Katalog Vorlage (Vehicle QR Template)
export interface VehicleQrTemplateConfig {
  title?: string | null;
  showLogo?: boolean;
  showVehicle?: boolean;
  showTechnician?: boolean;
  qrSize?: number;
  codeWidth?: number;
  descWidth?: number;
  showManufacturerTag?: boolean;
  showGroupHeaders?: boolean;
  showSecondaryDescription?: boolean;
}

export const getVehicleQrTemplate = async (): Promise<VehicleQrTemplateConfig> => {
  const response = await api.get<VehicleQrTemplateConfig>("/setup/reports/qr-template");
  return response.data;
};

export const updateVehicleQrTemplate = async (cfg: VehicleQrTemplateConfig): Promise<VehicleQrTemplateConfig> => {
  const response = await api.put<VehicleQrTemplateConfig>("/setup/reports/qr-template", cfg);
  return response.data;
};

export interface PdfHtmlTemplate {
  html: string;
  css: string;
}

export interface PurchaseOrderDesignerElement {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize?: number;
  align?: "left" | "center" | "right";
  content?: string;
}

export interface PurchaseOrderDesignerConfig {
  version: number;
  page: {
    width: number;
    height: number;
    orientation: "portrait" | "landscape";
  };
  elements: PurchaseOrderDesignerElement[];
}

export const getPdfHtmlTemplate = async (): Promise<PdfHtmlTemplate> => {
  const response = await api.get<PdfHtmlTemplate>("/setup/reports/pdf-template");
  return response.data;
};

export const updatePdfHtmlTemplate = async (template: PdfHtmlTemplate): Promise<PdfHtmlTemplate> => {
  const response = await api.put<PdfHtmlTemplate>("/setup/reports/pdf-template", template);
  return response.data;
};

export const getPurchaseOrderPdfTemplate = async (): Promise<PdfHtmlTemplate> => {
  const response = await api.get<PdfHtmlTemplate>("/setup/purchase-orders/pdf-template");
  return response.data;
};

export const updatePurchaseOrderPdfTemplate = async (
  template: PdfHtmlTemplate,
): Promise<PdfHtmlTemplate> => {
  const response = await api.put<PdfHtmlTemplate>("/setup/purchase-orders/pdf-template", template);
  return response.data;
};

export const getPurchaseOrderPdfDesigner = async (): Promise<PurchaseOrderDesignerConfig> => {
  const response = await api.get<PurchaseOrderDesignerConfig>("/setup/purchase-orders/pdf-designer");
  return response.data;
};

export const updatePurchaseOrderPdfDesigner = async (
  config: PurchaseOrderDesignerConfig,
): Promise<PurchaseOrderDesignerConfig> => {
  const response = await api.put<PurchaseOrderDesignerConfig>("/setup/purchase-orders/pdf-designer", config);
  return response.data;
};

export const setAutoBackupConfig = async (config: { 
  enabled: boolean; 
  frequency: 'daily' | 'weekly' | 'monthly'; 
  time: string;
  retentionDays?: number;
}): Promise<{ success: boolean; config: AutoBackupConfig }> => {
  const response = await api.post<{ success: boolean; config: AutoBackupConfig }>("/setup/backup/auto-config", config);
  return response.data;
};

export const getLastAutoBackup = async (): Promise<{ lastBackup: string | null }> => {
  const response = await api.get<{ lastBackup: string | null }>("/setup/backup/last-auto");
  return response.data;
};

// Auto-Backup Dateiverwaltung
export interface AutoBackupFile {
  filename: string;
  size: number;
  created: string;
  type?: 'auto' | 'manual';
}

export const listAutoBackups = async (): Promise<{ backups: AutoBackupFile[] }> => {
  const response = await api.get<{ backups: AutoBackupFile[] }>("/setup/backup/list");
  return response.data;
};

export const downloadAutoBackup = async (filename: string): Promise<Blob> => {
  const response = await api.get(`/setup/backup/download/${encodeURIComponent(filename)}`, {
    responseType: 'blob'
  });
  return response.data;
};

export const deleteAutoBackup = async (filename: string): Promise<{ success: boolean; message: string }> => {
  const response = await api.delete<{ success: boolean; message: string }>(`/setup/backup/delete/${encodeURIComponent(filename)}`);
  return response.data;
};

export interface RestoreFilters {
  targetBranchId?: string | null;
  vehicleIds?: string[] | null;
  locationIds?: string[] | null;
}

export const restoreSelective = async (backup: any, sections: string[], filters?: RestoreFilters): Promise<void> => {
  await api.post('/setup/restore/selective', { backup, sections, filters }, { timeout: 300000 });
};

export const loadBackupFromServer = async (filename: string): Promise<any> => {
  const response = await api.get(`/setup/backup/download/${encodeURIComponent(filename)}`, { responseType: 'json', timeout: 60000 });
  return response.data;
};

export const restoreFullBackup = async (backup: any): Promise<void> => {
  await api.post('/setup/restore', backup, { timeout: 300000 });
};

// Bewegungsverlauf
export interface MovementDto {
  id: string;
  type: "CHECKIN" | "CHECKOUT";
  quantity: number;
  occurredAt: string;
  source?: string | null;
  note?: string | null;
  item: { id: string; code: string; description: string };
  vehicle?: { id: string; licensePlate: string; description: string } | null;
  user?: { id: string; displayName: string } | null;
}

export interface MovementSummary {
  totalCheckinQty: number;
  totalCheckoutQty: number;
  totalCheckinCount: number;
  totalCheckoutCount: number;
}

export const fetchMovementHistory = async (params: {
  itemId?: string;
  vehicleId?: string;
  userId?: string;
  type?: "CHECKIN" | "CHECKOUT";
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  warehouseId?: string;
  source?: string;
}): Promise<{ movements: MovementDto[]; total: number; summary: MovementSummary }> => {
  const query = new URLSearchParams();
  if (params.itemId) query.append("itemId", params.itemId);
  if (params.vehicleId) query.append("vehicleId", params.vehicleId);
  if (params.userId) query.append("userId", params.userId);
  if (params.type) query.append("type", params.type);
  if (params.from) query.append("from", params.from);
  if (params.to) query.append("to", params.to);
  if (params.limit) query.append("limit", String(params.limit));
  if (params.offset) query.append("offset", String(params.offset));
  if (params.warehouseId) query.append("warehouseId", params.warehouseId);
  if (params.source) query.append("source", params.source);

  const response = await api.get<{ movements: MovementDto[]; total: number; summary: MovementSummary }>(`/stock/movements/history?${query.toString()}`);
  return response.data;
};

export const cleanupMovements = async (params: { before: string; type?: "CHECKIN" | "CHECKOUT" }): Promise<{ success: boolean; deleted: number }> => {
  const query = new URLSearchParams();
  query.append("before", params.before);
  if (params.type) query.append("type", params.type);
  const response = await api.delete<{ success: boolean; deleted: number }>(`/stock/movements/cleanup?${query.toString()}`);
  return response.data;
};

// Access Control
export const fetchPermissions = async (): Promise<PermissionDto[]> => {
  const response = await api.get<PermissionDto[]>("/access-control/permissions");
  return response.data;
};

export const fetchRolePermissions = async (): Promise<RolePermissionsDto[]> => {
  const response = await api.get<RolePermissionsDto[]>("/access-control/roles");
  return response.data;
};

// Rollenübersicht ohne admin-Rechte (nur JWT erforderlich, für Benutzer-Formular)
export const fetchRolesList = async (): Promise<RolePermissionsDto[]> => {
  const response = await api.get<RolePermissionsDto[]>("/access-control/roles/list");
  return response.data;
};

export const updateRolePermissions = async (role: string, permissions: string[]): Promise<void> => {
  await api.patch(`/access-control/roles/${role}/permissions`, { permissions });
};

export const fetchUserPermissions = async (userId: string): Promise<UserPermissionsDto> => {
  const response = await api.get<UserPermissionsDto>(`/access-control/users/${userId}/permissions`);
  return response.data;
};

export const updateUserPermissions = async (userId: string, overrides: string[], denials: string[] = []): Promise<void> => {
  await api.patch(`/access-control/users/${userId}/permissions`, { overrides, denials });
};

export const createRole = async (name: string, description?: string): Promise<RolePermissionsDto> => {
  const response = await api.post<RolePermissionsDto>("/access-control/roles", { name, description });
  return response.data;
};

export const updateRole = async (roleId: number, name?: string, description?: string): Promise<RolePermissionsDto> => {
  const response = await api.patch<RolePermissionsDto>(`/access-control/roles/${roleId}`, { name, description });
  return response.data;
};

export const deleteRole = async (roleId: number): Promise<void> => {
  await api.delete(`/access-control/roles/${roleId}`);
};

// Push-Benachrichtigungen
export interface PushSubscriptionPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export const fetchPushPublicKey = async (): Promise<string> => {
  const response = await api.get<{ publicKey: string }>("/notifications/public-key");
  return response.data.publicKey;
};

export const registerPushSubscription = async (subscription: PushSubscriptionPayload): Promise<{ success: boolean }> => {
  const response = await api.post<{ success: boolean }>("/notifications/subscribe", { subscription });
  return response.data;
};

// Maintenance API
export interface MaintenanceIssue {
  type: string;
  severity: 'warning' | 'error';
  count: number;
  description: string;
  details?: any[];
}

export interface MaintenanceCheckResponse {
  issues: MaintenanceIssue[];
  totalIssues: number;
}

export interface MaintenanceFixResponse {
  success: boolean;
  fixed: number;
  message: string;
}

export const previewPurgeOldOrders = async (years = 10): Promise<{ count: number; oldestDate: string | null; cutoffDate: string }> => {
  const response = await api.get("/purchase-orders/purge-preview", { params: { years } });
  return response.data;
};

export const purgeOldOrders = async (years = 10): Promise<{ deleted: number }> => {
  const response = await api.delete("/purchase-orders/purge", { params: { years } });
  return response.data;
};

export const checkDatabaseMaintenance = async (): Promise<MaintenanceCheckResponse> => {
  const response = await api.get<MaintenanceCheckResponse>("/maintenance/check");
  return response.data;
};

export const fixDatabaseIssues = async (): Promise<MaintenanceFixResponse> => {
  const response = await api.post<MaintenanceFixResponse>("/maintenance/fix");
  return response.data;
};

// Archive-Funktionen für Log-Archivierung
export interface ArchiveData {
  date: string;
  categories: {
    category: string;
    count: number;
    size: number;
  }[];
}

export interface ArchiveStats {
  totalArchives: number;
  oldestDate: string;
  newestDate: string;
  totalSize: number;
  byCategory: Record<string, { count: number; size: number }>;
  retentionDays: number;
  lastCleanupDate?: string;
}

export const fetchArchives = async (): Promise<ArchiveData[]> => {
  const response = await api.get<{ archives: ArchiveData[] }>("/logs/archives");
  return response.data.archives;
};

export const getArchiveStats = async (): Promise<ArchiveStats> => {
  const response = await api.get<ArchiveStats>("/logs/archives/stats");
  return response.data;
};

export const downloadArchive = async (date: string, category: string): Promise<void> => {
  const response = await api.get<any>(`/logs/archives/${date}/${category}/download`, {
    responseType: 'blob',
  });
  
  // Blob als Download-Link erstellen
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `logs-${date}-${category}.json`);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const downloadArchiveZip = async (dates: string[]): Promise<void> => {
  const response = await api.post<any>("/logs/archives/download/zip", { dates }, {
    responseType: 'blob',
  });
  
  // Blob als Download-Link erstellen
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  const timestamp = new Date().toISOString().slice(0, 10);
  link.setAttribute('download', `logs-archives-${timestamp}.zip`);
  document.body.appendChild(link);
  link.click();
  link.parentNode?.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const updateArchiveRetention = async (retentionDays: number): Promise<{ success: boolean; retentionDays: number }> => {
  const response = await api.put<{ success: boolean; retentionDays: number }>(
    "/logs/archives/config/retention",
    { retentionDays }
  );
  return response.data;
};

export const getArchiveRetention = async (): Promise<number> => {
  const response = await api.get<{ retentionDays: number }>("/logs/archives/config/retention");
  return response.data.retentionDays;
};

export const cleanupOldArchives = async (daysToKeep?: number): Promise<any> => {
  const response = await api.post<any>("/logs/archives/cleanup", { daysToKeep });
  return response.data;
};

export const forceArchiveNow = async (date?: string): Promise<any> => {
  const response = await api.post<any>("/logs/archives/force-archive", { date });
  return response.data;
};

// Nutzereinstellungen (Dashboard-Konfiguration, Schnellzugriff)
export const fetchUserSettings = async (): Promise<Record<string, unknown>> => {
  const response = await api.get<Record<string, unknown>>("/users/me/settings");
  return response.data;
};

export const saveUserSettings = async (settings: Record<string, unknown>): Promise<void> => {
  await api.put("/users/me/settings", settings);
};

// ============================================================
// Update-Funktion (In-App Docker-Update)
// ============================================================

export type UpdatePhase = "idle" | "starting" | "pulling" | "restarting" | "done" | "error";

export interface UpdateStatus {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  lastChecked: string | null;
  checking: boolean;
  error: string | null;
  updateRunning: boolean;
  updatePhase: UpdatePhase;
  updateStartedAt: string | null;
  updateLog: string[];
  instanceId: string;
}

export const fetchUpdateStatus = async (refresh = false): Promise<UpdateStatus> => {
  const response = await api.get<UpdateStatus>(`/update/status${refresh ? "?refresh=true" : ""}`);
  return response.data;
};

export const applyUpdate = async (): Promise<{ message: string }> => {
  const response = await api.post<{ message: string }>("/update/apply");
  return response.data;
};

export const fetchChangelog = async (): Promise<string> => {
  const response = await api.get<{ content: string }>("/update/changelog");
  return response.data.content;
};

// ── Reports ──────────────────────────────────────────────────────────────────

export interface SlowMoverRow {
  itemId: string;
  code: string;
  description: string;
  descriptionSecondary: string | null;
  manufacturer: string | null;
  productGroup: string | null;
  totalQuantity: number;
  lastMovementAt: string | null;
  daysSinceLastMovement: number | null;
}

export const fetchSlowMoverSettings = async (): Promise<{ days: number }> => {
  const response = await api.get<{ days: number }>("/reports/slow-movers/settings");
  return response.data;
};

export const saveSlowMoverSettings = async (days: number): Promise<{ days: number }> => {
  const response = await api.put<{ days: number }>("/reports/slow-movers/settings", { days });
  return response.data;
};

export const fetchSlowMovers = async (days?: number, warehouseId?: string): Promise<SlowMoverRow[]> => {
  const params: Record<string, unknown> = {};
  if (days !== undefined) params.days = days;
  if (warehouseId) params.warehouseId = warehouseId;
  const response = await api.get<SlowMoverRow[]>("/reports/slow-movers", { params });
  return response.data;
};

export interface ConsumptionTrendEntry {
  month: string; // "YYYY-MM"
  checkouts: number;
  checkins: number;
}

export const fetchConsumptionTrend = async (months: 6 | 12 = 12, itemId?: string, warehouseId?: string): Promise<ConsumptionTrendEntry[]> => {
  const params: Record<string, unknown> = { months };
  if (itemId) params.itemId = itemId;
  if (warehouseId) params.warehouseId = warehouseId;
  const response = await api.get<ConsumptionTrendEntry[]>("/reports/consumption-trend", { params });
  return response.data;
};

export interface ArticleActivityRow {
  itemId: string;
  code: string;
  description: string;
  descriptionSecondary: string | null;
  manufacturer: string | null;
  productGroup: string | null;
  checkoutCount: number;
  checkinCount: number;
  checkoutQty: number;
  checkinQty: number;
  lastMovementAt: string | null;
}

export const fetchArticleActivity = async (from: string, to: string, warehouseId?: string): Promise<ArticleActivityRow[]> => {
  const params: Record<string, unknown> = { from, to };
  if (warehouseId) params.warehouseId = warehouseId;
  const response = await api.get<ArticleActivityRow[]>("/reports/article-activity", { params });
  return response.data;
};

export const fetchWarehouses = async (): Promise<LocationDto[]> => {
  return fetchLocations({ type: "WAREHOUSE" });
};
