import { I18nService } from 'nestjs-i18n';
import { HelloService } from './hello.service';

describe('HelloService', () => {
  it('translates the hello message for the requested language', () => {
    const translate = jest.fn().mockReturnValue('Xin chào!');
    const i18nService = { translate } as unknown as I18nService;
    const service = new HelloService(i18nService);

    expect(service.getHello('vi')).toEqual({ message: 'Xin chào!' });
    expect(translate).toHaveBeenCalledWith('hello.HELLO', { lang: 'vi' });
  });
});
