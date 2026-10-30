from PIL import Image, ImageDraw
import glob,os
BG=(11,11,18,255)
logo=Image.open('www/logo.png').convert('RGBA');logo=logo.crop(logo.getbbox())
def icon(size,logo_frac=0.74,bg=True):
    im=Image.new('RGBA',(size,size),BG if bg else (0,0,0,0))
    w=int(size*logo_frac);h=int(logo.height*w/logo.width)
    im.alpha_composite(logo.resize((w,h),Image.LANCZOS),((size-w)//2,(size-h)//2-int(size*0.06)))
    d=ImageDraw.Draw(im);bw=int(size*0.46);bh=max(2,int(size*0.035));y=(size+h)//2+int(size*0.02);x0=(size-bw)//2
    for i in range(bw):
        t=i/bw;d.line([(x0+i,y),(x0+i,y+bh)],fill=(int(214-138*t),int(30+134*t),int(141+74*t),255))
    return im
icon(1024).convert('RGB').save('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')
for f in glob.glob('ios/App/App/Assets.xcassets/Splash.imageset/*.png'):
    s=Image.new('RGB',(2732,2732),BG[:3]);w=900;h=int(logo.height*w/logo.width);l=logo.resize((w,h),Image.LANCZOS)
    s.paste(l,((2732-w)//2,(2732-h)//2),l);s.save(f)
R='android/app/src/main/res'
for f in glob.glob(R+'/mipmap-*/ic_launcher.png')+glob.glob(R+'/mipmap-*/ic_launcher_round.png'):
    n=Image.open(f).size[0];im=icon(n)
    if 'round' in f:
        m=Image.new('L',(n,n),0);ImageDraw.Draw(m).ellipse([0,0,n-1,n-1],fill=255);im.putalpha(m)
    im.save(f)
for f in glob.glob(R+'/mipmap-*/ic_launcher_foreground.png'):
    n=Image.open(f).size[0];icon(n,0.5,bg=False).save(f)
for f in glob.glob(R+'/drawable*/splash.png'):
    W,H=Image.open(f).size;s=Image.new('RGB',(W,H),BG[:3]);w=int(min(W,H)*0.5);h=int(logo.height*w/logo.width);l=logo.resize((w,h),Image.LANCZOS)
    s.paste(l,((W-w)//2,(H-h)//2),l);s.save(f)
for dens,n in [('mdpi',24),('hdpi',36),('xhdpi',48),('xxhdpi',72),('xxxhdpi',96)]:
    os.makedirs(f'{R}/drawable-{dens}',exist_ok=True)
    im=Image.new('RGBA',(n,n),(0,0,0,0));d=ImageDraw.Draw(im);k=n/24;w=max(1,int(2*k));W=(255,255,255,255)
    d.rounded_rectangle([3*k,5*k,21*k,21*k],radius=2*k,outline=W,width=w);d.line([3*k,10*k,21*k,10*k],fill=W,width=w)
    d.line([8*k,3*k,8*k,7*k],fill=W,width=w);d.line([16*k,3*k,16*k,7*k],fill=W,width=w);d.ellipse([10*k,13*k,14*k,17*k],fill=W)
    im.save(f'{R}/drawable-{dens}/ic_stat_alumnos.png')
bgx=R+'/values/ic_launcher_background.xml'
if os.path.exists(bgx):
    t=open(bgx).read();import re;open(bgx,'w').write(re.sub(r'#[0-9A-Fa-f]{6}','#0B0B12',t))
print('iconos ok')
