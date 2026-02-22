import React from 'react';
import { ProFeatureLock } from '../../../../src/components/ProFeatureLock';

export default function AdminAthleteCompensation() {
  return (
    <ProFeatureLock
      featureName="Compensi Atleta"
      description="Visualizza e gestisci i compensi dell'atleta, le quietanze firmate e lo stato delle soglie fiscali. Questa funzionalità sarà disponibile nella versione PRO."
    />
  );
}
