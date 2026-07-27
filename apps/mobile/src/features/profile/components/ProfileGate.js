import { useCallback, useEffect, useState } from 'react';

import { AppButton } from '../../../components/AppButton';
import { InlineNotice } from '../../../components/InlineNotice';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { signOut, useAuthSession } from '../../auth';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { getProfile } from '../services/profileService';

export function ProfileGate({ children }) {
  const { user } = useAuthSession();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  const retry = useCallback(() => {
    setError('');
    setIsLoading(true);
    setRetryCount((current) => current + 1);
  }, []);

  useEffect(() => {
    let isActive = true;

    getProfile(user.id)
      .then((nextProfile) => {
        if (isActive) {
          setProfile(nextProfile);
          setIsLoading(false);
        }
      })
      .catch((profileError) => {
        if (isActive) {
          setError(profileError.message || 'Unable to load your profile.');
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [retryCount, user.id]);

  if (isLoading) {
    return <LoadingScreen message="Loading your workspace..." />;
  }

  if (error) {
    return (
      <OnboardingScreen
        customContent={
          <>
            <InlineNotice message={error} variant="error" />
            <AppButton label="Try again" onPress={retry} />
            <AppButton label="Sign out" onPress={signOut} variant="secondary" />
          </>
        }
        title="Connection problem"
      />
    );
  }

  if (!profile) {
    return <OnboardingScreen onComplete={setProfile} user={user} />;
  }

  return children(profile, setProfile);
}
