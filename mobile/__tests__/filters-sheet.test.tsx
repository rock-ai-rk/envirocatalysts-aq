/**
 * The filters sheet: choices are drafted, the button counts the matching cities before they are
 * applied, and "Show results" applies them all at once and closes the sheet. The API is faked.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Text } from 'react-native';

import FiltersScreen from '@/app/filters';
import { describeFilters, OverviewFiltersProvider, useOverviewFilters } from '@/state/overview-filters';

const mockBack = jest.fn();
// Stack.Screen only sets navigation options; here it renders the header buttons it declares
// (Cancel and Reset) so the test can press them.
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
  Stack: {
    Screen: ({ options }: { options?: { headerLeft?: () => ReactNode; headerRight?: () => ReactNode } }) => (
      <>
        {options?.headerLeft?.()}
        {options?.headerRight?.()}
      </>
    ),
  },
}));

// Two states; Delhi has one ranked city, all of India 218.
jest.mock('@/api/client', () => ({
  apiGet: jest.fn(async (path: string, params: Record<string, unknown> = {}) => {
    if (path === '/v1/meta') {
      return {
        periods: [],
        states: ['Delhi', 'Karnataka'],
        groups: [{ code: 'NCAP', label: 'NCAP', description: 'National Clean Air Programme cities' }],
      };
    }
    if (path === '/v1/overview') {
      const eligible = params.state === 'Delhi' ? 1 : params.state === 'Karnataka' ? 30 : 218;
      return { eligible, cities: [], excluded: [] };
    }
    throw new Error(`Unexpected request: ${path}`);
  }),
}));

/** Shows the filters the Overview would use, so the test can see what was applied. */
function AppliedFilters() {
  const { filters } = useOverviewFilters();
  return <Text testID="applied">{describeFilters(filters)}</Text>;
}

/** Testing Library 14's render is async, so every caller awaits it. */
function renderSheet() {
  // No cache to collect after the test, so nothing keeps Jest's process alive.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <OverviewFiltersProvider>{children}</OverviewFiltersProvider>
    </QueryClientProvider>
  );
  return render(
    <>
      <FiltersScreen />
      <AppliedFilters />
    </>,
    { wrapper },
  );
}

beforeEach(() => mockBack.mockClear());

it('counts the matches, re-counts on a new choice, and applies everything at once', async () => {
  await renderSheet();

  // The count arrives from the drafted filters' own request.
  expect(await screen.findByRole('button', { name: 'Show top 10 of 218 cities' })).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('radio', { name: 'Delhi' }));
  expect(screen.getByRole('radio', { name: 'Delhi' })).toBeChecked();
  const apply = await screen.findByRole('button', { name: 'Show 1 city' });

  // Nothing is applied until the button is pressed.
  expect(screen.getByTestId('applied')).toHaveTextContent('All India · All groups · Top 10 by Good days, best first');

  await fireEvent.press(apply);
  expect(screen.getByTestId('applied')).toHaveTextContent('Delhi · All groups · Top 10 by Good days, best first');
  expect(mockBack).toHaveBeenCalledTimes(1);
});

it('Reset returns the draft to the defaults without applying it', async () => {
  await renderSheet();

  // The states come from the API too, so the chip appears once /v1/meta answers.
  await fireEvent.press(await screen.findByRole('radio', { name: 'Karnataka' }));
  expect(await screen.findByRole('button', { name: 'Show top 10 of 30 cities' })).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: 'Reset' }));
  expect(screen.getByRole('radio', { name: 'All India' })).toBeChecked();
  expect(await screen.findByRole('button', { name: 'Show top 10 of 218 cities' })).toBeOnTheScreen();
  expect(mockBack).not.toHaveBeenCalled();
});
