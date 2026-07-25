import { useQuery } from "@tanstack/react-query";
import { STALE_TIME } from "@/shared/constants/app";
import { listBranches, listDepartments, listJobTitles, listUsers } from "./api";

export const lookupKeys = {
  departments: ["lookups", "departments"] as const,
  jobTitles: ["lookups", "jobTitles"] as const,
  branches: ["lookups", "branches"] as const,
  users: ["lookups", "users"] as const,
};

export const useDepartmentsLookup = () =>
  useQuery({ queryKey: lookupKeys.departments, queryFn: listDepartments, staleTime: STALE_TIME.medium });

export const useJobTitlesLookup = () =>
  useQuery({ queryKey: lookupKeys.jobTitles, queryFn: listJobTitles, staleTime: STALE_TIME.medium });

export const useBranchesLookup = () =>
  useQuery({ queryKey: lookupKeys.branches, queryFn: listBranches, staleTime: STALE_TIME.medium });

export const useUsersLookup = () =>
  useQuery({ queryKey: lookupKeys.users, queryFn: listUsers, staleTime: STALE_TIME.medium });
