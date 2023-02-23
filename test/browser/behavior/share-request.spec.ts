import { createAlova, useRequest } from '../../../src';
import VueHook from '../../../src/predefine/VueHook';
import { mockServer, untilCbCalled } from '../../utils';

beforeAll(() => mockServer.listen());
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

describe('Request shared', function () {
  test('should share request when use usehooks', async () => {
    const requestMockFn = jest.fn();
    const beforeRequestMockFn = jest.fn();
    const responseMockFn = jest.fn();
    const alova = createAlova({
      baseURL: 'http://xxx',
      localCache: {
        GET: 0
      },
      statesHook: VueHook,
      beforeRequest() {
        beforeRequestMockFn();
      },
      responsed(data) {
        responseMockFn();
        return data;
      },
      requestAdapter() {
        requestMockFn();
        return {
          response: async () => ({
            status: 200,
            data: { id: 1 }
          }),
          headers: async () => ({}),
          abort() {}
        };
      }
    });

    const Get = () => alova.Get<{ status: number; data: { id: number } }>('/unit-test');
    const state1 = useRequest(Get);
    const state2 = useRequest(Get);
    expect(state1.loading.value).toBeTruthy();
    expect(state1.data.value).toBeUndefined();
    expect(state1.downloading.value).toEqual({ total: 0, loaded: 0 });
    expect(state1.error.value).toBeUndefined();
    expect(state2.loading.value).toBeTruthy();
    expect(state2.data.value).toBeUndefined();
    expect(state2.downloading.value).toEqual({ total: 0, loaded: 0 });
    expect(state2.error.value).toBeUndefined();

    const { data: rawData } = await untilCbCalled(state1.onSuccess);
    expect(state1.loading.value).toBeFalsy();
    expect(state1.data.value.status).toBe(200);
    expect(state1.data.value.data).toStrictEqual({ id: 1 });
    expect(rawData.status).toBe(200);
    expect(rawData.data).toStrictEqual({ id: 1 });
    expect(state1.downloading.value).toEqual({ total: 0, loaded: 0 });
    expect(state2.loading.value).toBeFalsy();
    expect(state2.data.value.status).toBe(200);
    expect(state2.data.value.data).toStrictEqual({ id: 1 });
    expect(state2.downloading.value).toEqual({ total: 0, loaded: 0 });

    // 因为请求共享了，因此只执行一次
    expect(requestMockFn).toBeCalledTimes(1);

    // 全局请求钩子调用次数不变
    expect(beforeRequestMockFn).toBeCalledTimes(2);
    expect(responseMockFn).toBeCalledTimes(2);
  });

  test('should also share request when send request directly', async () => {
    const requestMockFn = jest.fn();
    const alova = createAlova({
      baseURL: 'http://xxx',
      localCache: {
        GET: 0
      },
      statesHook: VueHook,
      requestAdapter() {
        requestMockFn();
        return {
          response: async () => ({
            status: 200,
            data: { id: 1 }
          }),
          headers: async () => ({}),
          abort() {}
        };
      }
    });

    const Get = (plusStatus: boolean) =>
      alova.Get('/unit-test', {
        transformData: plusStatus
          ? (data: { status: number; data: { id: number } }) => data.status + 100
          : (data: { status: number; data: { id: number } }) => data.status
      });

    const [rawData1, rawData2] = await Promise.all([Get(false).send(), Get(true).send()]);
    expect(rawData1).toBe(200);
    expect(rawData2).toBe(300);

    // 因为请求共享了，因此只执行一次
    expect(requestMockFn).toBeCalledTimes(1);
  });

  test("shouldn't share request when close in global config", async () => {
    const requestMockFn = jest.fn();
    const alova = createAlova({
      baseURL: 'http://xxx',
      localCache: {
        GET: 0
      },
      statesHook: VueHook,
      shareRequest: false,
      requestAdapter() {
        requestMockFn();
        return {
          response: async () => ({
            status: 200,
            data: { id: 1 }
          }),
          headers: async () => ({}),
          abort() {}
        };
      }
    });

    const Get = () =>
      alova.Get('/unit-test', {
        transformData: (data: { status: number; data: { id: number } }) => data.status
      });

    const [rawData1, rawData2] = await Promise.all([Get().send(), Get().send()]);
    expect(rawData1).toBe(200);
    expect(rawData2).toBe(200);

    // 请求共享关闭了，执行了两次
    expect(requestMockFn).toBeCalledTimes(2);
  });

  test("shouldn't share request when close in method config", async () => {
    const requestMockFn = jest.fn();
    const alova = createAlova({
      baseURL: 'http://xxx',
      localCache: {
        GET: 0
      },
      statesHook: VueHook,
      requestAdapter() {
        requestMockFn();
        return {
          response: async () => ({
            status: 200,
            data: { id: 1 }
          }),
          headers: async () => ({}),
          abort() {}
        };
      }
    });

    const Get = () =>
      alova.Get('/unit-test', {
        shareRequest: false,
        transformData: (data: { status: number; data: { id: number } }) => data.status
      });

    const [rawData1, rawData2] = await Promise.all([Get().send(), Get().send()]);
    expect(rawData1).toBe(200);
    expect(rawData2).toBe(200);

    // 共享请求在method配置中关闭了，执行了两次
    expect(requestMockFn).toBeCalledTimes(2);
  });
});