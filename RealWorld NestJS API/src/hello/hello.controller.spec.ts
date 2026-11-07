import { I18nContext } from 'nestjs-i18n';
import { HelloController } from './hello.controller';
import { HelloService } from './hello.service';

describe('HelloController', () => {
  it('passes the resolved language to the service', () => {
    const getHello = jest.fn().mockReturnValue({ message: 'Hello World!' });
    const helloService = { getHello } as unknown as HelloService;
    const controller = new HelloController(helloService);
    const i18nContext = { lang: 'en' } as unknown as I18nContext;

    expect(controller.getHello(i18nContext)).toEqual({
      message: 'Hello World!',
    });
    expect(getHello).toHaveBeenCalledWith('en');
  });
});
