export type IssuanceRecord = {
  id: string;
  methodology: string;
  project: string;
  vintage: string;
  issued: number;
  retired: number;
};

export const MOCK_ISSUANCES: IssuanceRecord[] = [
  {
    id: "issuance-001",
    methodology: "AR-AMS0003",
    project: "Sierra Reforestation Phase I",
    vintage: "2022",
    issued: 185_000,
    retired: 45_000,
  },
  {
    id: "issuance-002",
    methodology: "AR-AMS0007",
    project: "Delta Mangrove Restoration",
    vintage: "2023",
    issued: 212_500,
    retired: 60_000,
  },
  {
    id: "issuance-003",
    methodology: "AR-AMS0007",
    project: "Ridge Carbon Buffer",
    vintage: "2021",
    issued: 97_350,
    retired: 12_200,
  },
];

export function calculateTotals(records: IssuanceRecord[]) {
  return records.reduce(
    (acc, record) => {
      acc.issued += record.issued;
      acc.retired += record.retired;
      acc.balance += record.issued - record.retired;
      return acc;
    },
    { issued: 0, retired: 0, balance: 0 }
  );
}
