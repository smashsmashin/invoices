class Verbally_en {

    static TOO_BIG="too much";

    static AND="and"; 

    static _0="zero"; 
    static _1="one"; 
    static _2="two"; 
    static _3="three"; 
    static _4="four"; 
    static _5="five"; 
    static _6="six"; 
    static _7="seven"; 
    static _8="eight"; 
    static _9="nine"; 
    static _10="ten"; 
    static _11="eleven"; 
    static _12="twelve"; 
    static _13="thirteen"; 
    static _14="fourteen"; 
    static _15="fifteen"; 
    static _16="sixteen"; 
    static _17="seventeen"; 
    static _18="eighteen"; 
    static _19="nineteen"; 
    static _20="twenty"; 
    static _30="thirty"; 
    static _40="forty"; 
    static _50="fifty"; 
    static _60="sixty"; 
    static _70="seventy"; 
    static _80="eighty"; 
    static _90="ninety"; 

    static _100="hundred"; 

    static CURRENCY="euro"; 
    static CURRENCY_HUNDREDS="cents"; 

    static BILLION="billion"; 

    static MILLION="million"; 

    static THOUSAND="thousand"; 

    static convert(value)
    {
        value = Math.round(parseFloat(value)*100)/100;
        var buf={text: ''}; // shared by the recursive _convert calls, which append to it
        Verbally_en._convert(buf, Math.floor(value), 0);
        Verbally_en.footer(buf, value);
        
        return buf.text;
    }

    static _convert(buf, number)
    {
        if(number==0)
        {
            if(buf.text.length==0)
                buf.text += Verbally_en._0 + ' ';
            
            return;
        }
        
        if(number >= 1e24)
        {
            buf.text += TOO_BIG;
            return;
        }
        
        if(number>=1e12)
        {
            Verbally_en._convert(buf, number/1e12);
            number=Math.round(number%1e12);
            buf.text += Verbally_en.BILLION + ' ';
        }
        
        if(number>=1e6)
        {
            Verbally_en._convert(buf, number/1e6);
            number=Math.round(number%1e6);
            buf.text += Verbally_en.MILLION + ' ';
        }
        
        if(number>=1e3)
        {
            Verbally_en._convert(buf, number/1e3);
            number=Math.round(number%1e3);
            buf.text += Verbally_en.THOUSAND + ' ';
        }
        
        if(number>=1e2)
        {
            Verbally_en._convert(buf, number/1e2);
            number=Math.round(number%1e2);
            buf.text += Verbally_en._100 + ' ';
            
            if(number>0)
                buf.text += Verbally_en.AND + ' ';
        }
        
        if(number>=20)
        {
            switch(Math.floor(number/10))
            {
                case 2:
                    buf.text += Verbally_en._20;
                    break;
                case 3:
                    buf.text += Verbally_en._30;
                    break;
                case 4:
                    buf.text += Verbally_en._40;
                    break;
                case 5:
                    buf.text += Verbally_en._50;
                    break;
                case 6:
                    buf.text += Verbally_en._60;
                    break;
                case 7:
                    buf.text += Verbally_en._70;
                    break;
                case 8:
                    buf.text += Verbally_en._80;
                    break;
                case 9:
                    buf.text += Verbally_en._90;
                    break;
            }
            number=number%10;
            if(number>0)
                buf.text += ' ';
        }
        
        switch(Math.floor(number))
        {
            case 1:
                buf.text += Verbally_en._1;
                break;
            case 2:
                buf.text += Verbally_en._2;
                break;
            case 3:
                buf.text += Verbally_en._3;
                break;
            case 4:
                buf.text += Verbally_en._4;
                break;
            case 5:
                buf.text += Verbally_en._5;
                break;
            case 6:
                buf.text += Verbally_en._6;
                break;
            case 7:
                buf.text += Verbally_en._7;
                break;
            case 8:
                buf.text += Verbally_en._8;
                break;
            case 9:
                buf.text += Verbally_en._9;
                break;
            case 10:
                buf.text += Verbally_en._10;
                break;
            case 11:
                buf.text += Verbally_en._11;
                break;
            case 12:
                buf.text += Verbally_en._12;
                break;
            case 13:
                buf.text += Verbally_en._13;
                break;
            case 14:
                buf.text += Verbally_en._14;
                break;
            case 15:
                buf.text += Verbally_en._15;
                break;
            case 16:
                buf.text += Verbally_en._16;
                break;
            case 17:
                buf.text += Verbally_en._17;
                break;
            case 18:
                buf.text += Verbally_en._18;
                break;
            case 19:
                buf.text += Verbally_en._19;
                break;
        }
        buf.text += ' ';
        
    }

	static footer(buf, number)
	{
		buf.text += Verbally_en.CURRENCY + ' ' + Verbally_en.AND + ' ';
		
        var cents = Math.round(number*100)%100; // round, not floor: 1.15*100 is 114.999...
		if(cents<10)
			buf.text += '0';
		buf.text += cents + ' ' + Verbally_en.CURRENCY_HUNDREDS;
	}
}

Object.freeze(Verbally_en); 