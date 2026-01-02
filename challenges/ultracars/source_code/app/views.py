from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout
from django.contrib import messages
from django.contrib.auth.models import User
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
import base64
import pickle
from django.views.decorators.csrf import csrf_exempt
from django.http import HttpResponse
from django.utils.safestring import mark_safe

def index(request):
    return render(request, 'index.html')

def login_view(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        user = authenticate(request, username=username, password=password)
        if user is not None:
            auth_login(request, user)
            return redirect('dashboard')
        else:
            messages.error(request, 'Usuário ou senha inválidos!')
    return render(request, 'login.html')

def signup(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        password2 = request.POST.get('password2')
        if password != password2:
            messages.error(request, 'Passwords do not match!')
        elif User.objects.filter(username=username).exists():
            messages.error(request, 'Username already exists!')
        else:
            user = User.objects.create_user(username=username, password=password)
            auth_login(request, user)
            return redirect('dashboard')
    return render(request, 'signup.html')


def dashboard(request):
    if not request.user.is_authenticated:
        return redirect('login')
    return render(request, 'dashboard.html')

def logout_view(request):
    auth_logout(request)
    return redirect('index')

@csrf_exempt
def buy_car(request):
    if request.method == 'POST' and request.user.is_authenticated:
        car = request.POST.get('car')
        if 'cart' not in request.session:
            request.session['cart'] = []
        cart = request.session['cart']
        cart.append(car)
        request.session['cart'] = cart
        return JsonResponse({'success': True, 'message': f'Congratulations! You bought a {car}!'})
    return JsonResponse({'success': False, 'message': 'You must be logged in to buy a car.'})

def cart(request):
    if not request.user.is_authenticated:
        return redirect('login')
    cart = request.session.get('cart', [])
    remove_car = request.GET.get('remove')
    if remove_car and remove_car in cart:
        cart = [c for c in cart if c != remove_car or cart.remove(c)]
        request.session['cart'] = cart
    return render(request, 'cart.html', {'cart': cart})

def edit_profile(request):
    result = None
    error = None
    if not request.user.is_authenticated:
        return redirect('login')
    profile = request.session.get('profile', {'name': request.user.username, 'description': ''})
    if request.method == 'POST':
        name = request.POST.get('name', profile['name'])
        description_data = request.POST.get('description', '')
        try:
            try:
                description = pickle.loads(base64.b64decode(description_data))
            except Exception:
                description = description_data
            profile['description'] = description
            profile['name'] = name
            request.session['profile'] = profile
            result = f'Profile updated!'
        except Exception as e:
            error = f'Error: {e}'
            print(error)
    return render(request, 'edit_profile.html', {'result': result, 'error': error, 'profile': profile})