import type { Timestamp } from '../../../shared/services/firebase';

export type LabId = string & { readonly __labId: unique symbol };
export type UserId = string & { readonly __userId: unique symbol };

export type { Timestamp };
