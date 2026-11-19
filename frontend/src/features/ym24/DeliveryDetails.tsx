import { ContentCard } from '../../components/ContentCard';

export default function DeliveryDetails({ tripId }: { tripId: string }) {
  return (
    <ContentCard title="Delivery details" subtitle={`Trip ${tripId}`}>
      <p>This page is work in progress.</p>
    </ContentCard>
  );
}