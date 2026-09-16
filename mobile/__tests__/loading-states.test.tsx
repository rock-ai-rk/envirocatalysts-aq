/**
 * Loading, offline and error states: a skeleton says what is loading, offline it says the app is
 * waiting for a connection instead of pulsing forever, and an error offers "Try again".
 */

import { onlineManager } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { SkeletonChart } from '@/components/skeleton';
import { StatusMessage } from '@/components/status-message';

afterEach(() => onlineManager.setOnline(true));

it('a skeleton is one element that says what is loading', async () => {
  await render(<SkeletonChart label="Loading hourly values" />);
  expect(screen.getByLabelText('Loading hourly values')).toBeOnTheScreen();
});

it('offline, a skeleton says it is waiting for a connection', async () => {
  onlineManager.setOnline(false);
  await render(<SkeletonChart label="Loading hourly values" />);
  expect(screen.getByText('Waiting for a connection')).toBeOnTheScreen();
  expect(screen.queryByLabelText('Loading hourly values')).toBeNull();
});

it('an error shows its message and retries on "Try again"', async () => {
  const onRetry = jest.fn();
  await render(<StatusMessage kind="error" message="Can't reach the server." onRetry={onRetry} />);
  expect(screen.getByText("Can't reach the server.")).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: /try again/i }));
  expect(onRetry).toHaveBeenCalledTimes(1);
});
