export enum AlgorithmType {
  LINEAR_REGRESSION = 'linear_regression',
  POLYNOMIAL_REGRESSION = 'polynomial_regression',
  RIDGE_REGRESSION = 'ridge_regression',
  LASSO_REGRESSION = 'lasso_regression',
}

/** Trạng thái huấn luyện */
export enum ExperimentStatus {
  DRAFT = 'draft',
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/** Trạng thái đồng bộ, tách riêng với trạng thái huấn luyện */
export enum SyncStatus {
  SYNCED = 'synced',
  PENDING_SYNC = 'pending_sync',
  CONFLICT = 'conflict',
}

/** Cách chia dữ liệu train / validation / test */
export enum SplitMethod {
  RANDOM = 'random',
  STRATIFIED = 'stratified',
  SEQUENTIAL = 'sequential',
}

/** Các bước tiền xử lý dữ liệu */
export enum PreprocessingStepType {
  STANDARD_SCALER = 'standard_scaler',
  MIN_MAX_SCALER = 'min_max_scaler',
  IMPUTE_MEAN = 'impute_mean',
  IMPUTE_MEDIAN = 'impute_median',
  DROP_MISSING = 'drop_missing',
  REMOVE_OUTLIERS = 'remove_outliers',
}