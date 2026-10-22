"use client";
import { fetchProjectsSuccess } from "@/redux/slice/projects";
import { useAppDispatch } from "@/redux/store";
import React, { useEffect } from "react";
import { useAuth } from '@/components/auth/provider';
import { useRouter } from 'next/navigation';
import { clearProjects } from '@/redux/slice/projects';

type Props = {
  children: React.ReactNode;
  initialProjects: any;
  ownerUid: string;
};

const ProjectsProvider = ({ children, initialProjects, ownerUid }: Props) => {
  const dispatch = useAppDispatch();
  const { user, ready } = useAuth();
  const router = useRouter();
  const uid = user?.uid;
  useEffect(() => {
    if (!ready || !uid || uid !== ownerUid) {
      dispatch(clearProjects());
      // RSC/router snapshots can predate the newly established session cookie.
      if (ready && uid && uid !== ownerUid) router.refresh();
      return;
    }
    // Initialize Redux state with SSR data
    if (initialProjects) {
      const projectsData = Array.isArray(initialProjects)
        ? initialProjects
        : (initialProjects._valueJSON || []);
      dispatch(
        fetchProjectsSuccess({
          projects: projectsData,
          total: projectsData.length,
        })
      );
    }
  }, [dispatch, initialProjects, ownerUid, ready, uid, router]);

  if (!ready || !uid || uid !== ownerUid) return null;
  return <>{children}</>;
};

export default ProjectsProvider;
