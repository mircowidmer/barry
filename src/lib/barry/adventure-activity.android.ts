import type AdventureActivity from './adventure-activity';

// Live Activities exist only on iOS, and creating one on Android throws while the client module loads.
const noLiveActivity: Pick<typeof AdventureActivity, 'getInstances' | 'start'> = {
  getInstances: () => [],
  start: () => {
    throw new Error('Live Activities exist only on iOS');
  },
};

export default noLiveActivity;
