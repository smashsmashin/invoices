class Verbally_bg {

	static TOO_BIG="\u0442\u0432\u044a\u0440\u0434\u0435 \u043c\u043d\u043e\u0433\u043e";//������ �����
	
	static AND="\u0438"; //�
	
	static _0="\u043d\u0443\u043b\u0430"; //����
	static _1="\u0435\u0434\u0438\u043d"; //����
	static _1x="\u0435\u0434\u043d\u0430"; //����
	static _2="\u0434\u0432\u0430"; //���
	static _2x="\u0434\u0432\u0435"; //���
	static _3="\u0442\u0440\u0438"; //���
	static _4="\u0447\u0435\u0442\u0438\u0440\u0438"; //������
	static _5="\u043f\u0435\u0442"; //���
	static _6="\u0448\u0435\u0441\u0442"; //����
	static _7="\u0441\u0435\u0434\u0435\u043c"; //�����
	static _8="\u043e\u0441\u0435\u043c"; //����
	static _9="\u0434\u0435\u0432\u0435\u0442"; //�����
	static _10="\u0434\u0435\u0441\u0435\u0442"; //�����
	static _11="\u0435\u0434\u0438\u043d\u0430\u0434\u0435\u0441\u0435\u0442"; //����������
	static _12="\u0434\u0432\u0430\u043d\u0430\u0434\u0435\u0441\u0435\u0442"; //����������
	static _13="\u0442\u0440\u0438\u043d\u0430\u0434\u0435\u0441\u0435\u0442"; //����������
	static _14="\u0447\u0435\u0442\u0438\u0440\u0438\u043d\u0430\u0434\u0435\u0441\u0435\u0442"; //�������������
	static _15="\u043f\u0435\u0442\u043d\u0430\u0434\u0435\u0441\u0435\u0442"; //����������
	static _16="\u0448\u0435\u0441\u0442\u043d\u0430\u0434\u0435\u0441\u0435\u0442"; //�����������
	static _17="\u0441\u0435\u0434\u0435\u043c\u043d\u0430\u0434\u0435\u0441\u0435\u0442"; //������������
	static _18="\u043e\u0441\u0435\u043c\u043d\u0430\u0434\u0435\u0441\u0435\u0442"; //�����������
	static _19="\u0434\u0435\u0432\u0435\u0442\u043d\u0430\u0434\u0435\u0441\u0435\u0442"; //������������
	
	static _100="\u0441\u0442\u043e"; //���
	static LO_100="\u0441\u0442\u0430"; //���
	static HI_100="\u0441\u0442\u043e\u0442\u0438\u043d"; //������
	
	static CURRENCY="\u043b\u0435\u0432"; //����
	static CURRENCYx="\u043b\u0435\u0432\u0430"; //����
	static CURRENCY_HUNDREDS="\u0441\u0442\u043e\u0442\u0438\u043d\u043a\u0430"; //��������
	static CURRENCY_HUNDREDSx="\u0441\u0442\u043e\u0442\u0438\u043d\u043a\u0438"; //��������
	
	static BILLION="\u043c\u0438\u043b\u0438\u0430\u0440\u0434"; //�������
	static BILLIONS="\u043c\u0438\u043b\u0438\u0430\u0440\u0434\u0430"; //��������
	
	static MILLION="\u043c\u0438\u043b\u0438\u043e\u043d"; //������
	static MILLIONS="\u043c\u0438\u043b\u0438\u043e\u043d\u0430"; //�������
	
	static THOUSAND="\u0445\u0438\u043b\u044f\u0434\u0430"; //������
	static THOUSANDS="\u0445\u0438\u043b\u044f\u0434\u0438"; //������

    static convert(value)
    {
        value = Math.round(parseFloat(value)*100)/100;
        var buf=new StringBuffer();
        Verbally_bg._convert(buf, Math.floor(value), 0);
        Verbally_bg.footer(buf, value);
        
        return buf.toString();
    }

    static _convert(buf, number, power)
    {
		if(number==0)
		{
			if(buf.length()==0)
				buf.append(Verbally_bg._0).append(' ');
			
			return;
		}
		
		if(number >= 1e12)
		{
			buf.append(Verbally_bg.TOO_BIG);
			return;
		}
		
		if(number>=1e9)
		{
			var plural=number>=2e9;
			
			Verbally_bg._convert(buf,number/1e9, 9);
			number=Math.round(number%1e9);
			buf.append(plural?Verbally_bg.BILLIONS:Verbally_bg.BILLION).append(' ');
		}
		
		if(number>=1e6)
		{
			var plural=number>=2e6;
			
			Verbally_bg._convert(buf,number/1e6, 6);
			number=Math.round(number%1e6);
			buf.append(plural?Verbally_bg.MILLIONS:Verbally_bg.MILLION).append(' ');
		}
		
		if(number>=1e3)
		{
			var plural=number>=2e3;
			
			var andPos=buf.length();
			
			if(plural)
                Verbally_bg._convert(buf,number/1e3, 3);
			number=Math.round(number%1e3);
			buf.append(plural?Verbally_bg.THOUSANDS:Verbally_bg.THOUSAND).append(' ');
			
			if(!plural && Math.floor(number)==0 && andPos>0)
				buf.insert(andPos,Verbally_bg.AND).insert(andPos+1,' ');
		}
		
		if(number>=1e2)
		{
			var andPos=buf.length();
			
			var n=Math.floor(number/1e2);
			var plural=number>=2e2;
			if(plural)
                Verbally_bg._convert(buf, n, 2);
			switch(n)
			{
				case 1:
					buf.append(Verbally_bg._100);
					break;
				case 2:
				case 3:
					buf.append(Verbally_bg.LO_100);
					break;
				default:
					buf.append(Verbally_bg.HI_100);
			}
			buf.append(' ');
			
			number=Math.round(number%1e2);
			
			if(Math.floor(number)==0 && andPos>0)
				buf.insert(andPos,Verbally_bg.AND).insert(andPos+1,' ');
		}
		
		if(number>=20)
		{
			var andPos=buf.length();
			
			Verbally_bg._convert(buf, number/10, 1);
			number=Math.round(number%10);
			buf.append(Verbally_bg._10).append(' ');
			
			if(Math.floor(number)==0 && andPos>0)
				buf.insert(andPos,Verbally_bg.AND).insert(andPos+1,' ');
		}
		
		if(number>0 && buf.length()>0 && power%3==0)
			buf.append(Verbally_bg.AND).append(' ');
		
		switch(Math.floor(number))
		{
			case 1:
				buf.append(power==3?Verbally_bg._1x:Verbally_bg._1);
				break;
			case 2:
				buf.append(power==2 || power==3?Verbally_bg._2x:Verbally_bg._2);
				break;
			case 3:
				buf.append(Verbally_bg._3);
				break;
			case 4:
				buf.append(Verbally_bg._4);
				break;
			case 5:
				buf.append(Verbally_bg._5);
				break;
			case 6:
				buf.append(Verbally_bg._6);
				break;
			case 7:
				buf.append(Verbally_bg._7);
				break;
			case 8:
				buf.append(Verbally_bg._8);
				break;
			case 9:
				buf.append(Verbally_bg._9);
				break;
			case 10:
				buf.append(Verbally_bg._10);
				break;
			case 11:
				buf.append(Verbally_bg._11);
				break;
			case 12:
				buf.append(Verbally_bg._12);
				break;
			case 13:
				buf.append(Verbally_bg._13);
				break;
			case 14:
				buf.append(Verbally_bg._14);
				break;
			case 15:
				buf.append(Verbally_bg._15);
				break;
			case 16:
				buf.append(Verbally_bg._16);
				break;
			case 17:
				buf.append(Verbally_bg._17);
				break;
			case 18:
				buf.append(Verbally_bg._18);
				break;
			case 19:
				buf.append(Verbally_bg._19);
				break;
		}
		
		if(number>0 && power%3==0)
			buf.append(' ');
    }

    static footer(buf, number)
	{
		// if(buf.length()>0 && buf.charAt(buf.length()-1)!=' ')
		// 	buf.append(' ');
		
		buf.append(Math.floor(number) == 1 ? Verbally_bg.CURRENCY : Verbally_bg.CURRENCYx).append(' ').append(Verbally_bg.AND).append(' ');

        var cents = Math.round(number*100)%100; // round, not floor: 1.15*100 is 114.999...
		if(cents<10)
			buf.append('0');
		buf.append(cents).append(' ').append(cents == 1 ? Verbally_bg.CURRENCY_HUNDREDS : Verbally_bg.CURRENCY_HUNDREDSx);
	}
}

Object.freeze(Verbally_en); 