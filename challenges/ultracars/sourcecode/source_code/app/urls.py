from django.urls import path
from . import views
from django.contrib import admin
from django.urls import path
from django.conf import settings
from django.urls import re_path
from django.views.static import serve
from pathlib import Path
from django.urls import re_path
from django.views.static import serve

BASE_DIR = Path(__file__).resolve().parent.parent

urlpatterns = [
    path('', views.index, name='index'),
    path('login/', views.login_view, name='login'),
    path('signup/', views.signup, name='signup'),
    path('dashboard/', views.dashboard, name='dashboard'),
    path('buy_car/', views.buy_car, name='buy_car'),
    path('logout/', views.logout_view, name='logout'),
    path('buy/', views.buy_car, name='buy_car'),
    path('cart/', views.cart, name='cart'),
    path('edit_profile/', views.edit_profile, name='edit_profile'),
    re_path(r'^media/(?P<path>.*)$', serve,{'document_root': settings.MEDIA_ROOT}),
    re_path(r'^static/(?P<path>.*)$', serve,{'document_root': settings.STATIC_ROOT}),
]

