import type { Client } from "@/types/client";

let clients: Client[] = [];

export function readClients(): Client[] {
  return clients;
}

export function writeClients(next: Client[]): void {
  clients = next;
}

/** Test-only: restore the store to its empty seeded state between test cases. */
export function resetClientsStore(): void {
  clients = [];
}
