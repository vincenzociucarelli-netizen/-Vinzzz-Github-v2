import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function CollaboratoreIndex() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to profile page directly (like coach and dirigente)
    router.replace('/collaboratore/profile');
  }, []);

  return null;
}
